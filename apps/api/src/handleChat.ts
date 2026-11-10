/**
 * POST /agent/chat: checks the request, makes one call to the model, and
 * streams the answer as server-sent events. The shape follows parity's
 * handleAsk: every outside thing (the model, the limits, the clock, the log)
 * is passed in, so the whole path is tested without a key or a network.
 *
 * The API key stays on the server. Raw upstream errors are never forwarded.
 * Nothing from the conversation is ever logged: only counts and timings.
 */
import { AGENT_LIMITS, parseToolCall, type AgentEvent, type AgentRefusalCode } from '@slip/agent';
import type { Effort, ModelEvent, ModelRequest } from './claudeStream.ts';
import { clientIp, type Guards } from './rateLimit.ts';
import { validateChat } from './validate.ts';

export interface ChatDeps {
  env: { apiKey: string | undefined; model: string | undefined; live: boolean; effort: Effort };
  streamModel: (
    request: ModelRequest,
    apiKey: string,
    signal: AbortSignal,
  ) => AsyncIterable<ModelEvent>;
  guards: Guards;
  describeError: (error: unknown) => { log: string; retryable: boolean };
  /** One line per event. Never the question, a tool input or a tool result. */
  log: (line: Record<string, string | number | boolean>) => void;
  now: () => number;
}

function refuse(
  status: number,
  code: AgentRefusalCode,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { code, message },
    { status, headers: { 'Cache-Control': 'no-store', ...headers } },
  );
}

const encoder = new TextEncoder();
const frame = (event: AgentEvent): Uint8Array =>
  encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

export async function handleChat(request: Request, deps: ChatDeps): Promise<Response> {
  const { apiKey, model, live } = deps.env;
  if (!live || !apiKey || !model) {
    return refuse(
      503,
      'not-configured',
      'The live assistant is not switched on. Scripted answers are available.',
    );
  }

  // Read no more than the limit, whatever Content-Length claims.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > AGENT_LIMITS.bodyBytes)
    return refuse(413, 'too-large', 'The request is too large.');
  const raw = await request.text();
  if (encoder.encode(raw).length > AGENT_LIMITS.bodyBytes)
    return refuse(413, 'too-large', 'The request is too large.');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return refuse(400, 'bad-request', 'The request body must be JSON.');
  }
  const validation = validateChat(body);
  if (!validation.ok)
    return refuse(
      validation.code === 'step-limit' ? 409 : 400,
      validation.code,
      validation.message,
    );

  // A visitor is limited by questions, not by the tool calls a question needs.
  if (validation.newQuestion) {
    const limit = await deps.guards.question(clientIp(request.headers), deps.now());
    if (!limit.allowed) {
      return refuse(
        429,
        'rate-limited',
        'Too many questions. Please wait a moment and try again.',
        {
          'Retry-After': String(limit.retryAfterSeconds),
        },
      );
    }
  }
  const cap = await deps.guards.modelCall(deps.now());
  if (!cap.allowed) {
    deps.log({ event: 'daily-cap-reached' });
    return refuse(
      429,
      'daily-cap',
      'The live assistant has reached its limit for today. Scripted answers are available.',
      {
        'Retry-After': String(cap.retryAfterSeconds),
      },
    );
  }

  return streamTurn(validation.messages, validation.callsUsed, model, apiKey, request.signal, deps);
}

function streamTurn(
  messages: unknown[],
  callsUsed: number,
  model: string,
  apiKey: string,
  signal: AbortSignal,
  deps: ChatDeps,
): Response {
  const started = deps.now();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sentText = false;
      const fail = (event: Extract<AgentEvent, { type: 'error' }>) => {
        controller.enqueue(frame(event));
        controller.close();
      };
      try {
        let end: Extract<ModelEvent, { type: 'end' }> | null = null;
        for await (const event of deps.streamModel(
          { model, effort: deps.env.effort, messages },
          apiKey,
          signal,
        )) {
          if (event.type === 'end') {
            end = event;
            break;
          }
          sentText = true;
          controller.enqueue(frame({ type: 'text-delta', text: event.text }));
        }
        if (!end) throw new Error('The model stream ended without a final message.');

        const toolCalls = end.content.filter(
          (block): block is { type: 'tool_use'; id: string; name: string; input: unknown } =>
            (block as { type?: unknown } | null)?.type === 'tool_use',
        );
        deps.log({
          event: 'turn',
          ms: deps.now() - started,
          call: callsUsed + 1,
          stop: end.stopReason ?? 'none',
          tools: toolCalls.length,
          inputTokens: end.usage.input,
          outputTokens: end.usage.output,
          cacheReadTokens: end.usage.cacheRead,
          cacheWriteTokens: end.usage.cacheWrite,
        });

        if (end.stopReason === 'refusal') {
          return fail({
            type: 'error',
            code: 'refused',
            message: 'The assistant could not answer that question.',
            retryable: false,
          });
        }
        // A turn cut off by the output cap may hold a tool call with half its input: never pass that on.
        if (end.stopReason !== 'end_turn' && end.stopReason !== 'tool_use') {
          return fail({
            type: 'error',
            code: 'interrupted',
            message: 'The answer was cut short. Please try again.',
            retryable: true,
          });
        }
        if (end.stopReason === 'tool_use' && toolCalls.length === 0) {
          return fail({
            type: 'error',
            code: 'interrupted',
            message: 'The answer was cut short. Please try again.',
            retryable: true,
          });
        }

        // Tool inputs arrive unvalidated, so check each one here. A bad one is still
        // announced, marked invalid, so the browser can answer it with an error result.
        for (const call of toolCalls) {
          const parsed = parseToolCall(call.name, call.input);
          controller.enqueue(
            frame(
              parsed.ok
                ? {
                    type: 'tool-request',
                    toolUseId: call.id,
                    name: call.name,
                    input: parsed.input,
                    valid: true,
                  }
                : {
                    type: 'tool-request',
                    toolUseId: call.id,
                    name: String(call.name),
                    input: null,
                    valid: false,
                    problem: parsed.problem,
                  },
            ),
          );
        }
        controller.enqueue(
          frame({
            type: 'done',
            stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
            assistant: end.content,
            callsUsed: callsUsed + 1,
            callsAllowed: AGENT_LIMITS.callsPerQuestion,
          }),
        );
        controller.close();
      } catch (error) {
        if (signal.aborted) {
          // The browser stopped listening (Stop, or a new question): nothing to send.
          controller.close();
          return;
        }
        const { log, retryable } = deps.describeError(error);
        deps.log({
          event: 'model-error',
          ms: deps.now() - started,
          detail: log,
          afterText: sentText,
        });
        if (sentText) {
          fail({
            type: 'error',
            code: 'interrupted',
            message: 'The answer was interrupted. Please try again.',
            retryable: true,
          });
        } else if (retryable) {
          fail({
            type: 'error',
            code: 'unavailable',
            message: 'The assistant is unavailable. Please try again.',
            retryable: true,
          });
        } else {
          fail({
            type: 'error',
            code: 'rejected',
            message: 'The AI service could not take this request right now.',
            retryable: false,
          });
        }
      }
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
