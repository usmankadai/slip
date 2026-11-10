/**
 * The one place that talks to Anthropic. Adapted from parity
 * (api/_lib/claudeStream.ts) and extended for tools.
 */
import Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFINITIONS } from '@slip/agent';
import { SYSTEM_PROMPT } from './prompt.ts';

/** What the model call yields: pieces of answer text, then the finished turn. */
export type ModelEvent =
  | { type: 'text'; text: string }
  | {
      type: 'end';
      stopReason: string | null;
      /** The assistant's content blocks, to be replayed unchanged on the next request. */
      content: unknown[];
      usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
    };

export interface ModelRequest {
  model: string;
  effort: Effort;
  messages: unknown[];
}

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

/** Models that accept the server-side refusal fallback in its "default" form. */
const FALLBACK_MODELS = new Set([
  'claude-fable-5-2',
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);

/** A cap on one turn's output, thinking included: a deliberate limit on cost for a public demo. */
const MAX_TOKENS = 16_000;

/**
 * The request sent for every turn. Kept as a pure function so tests can
 * check what is sent without a key or a network.
 *
 * - Tools and the system prompt never vary, and the breakpoint on the system
 *   prompt caches both (tools render before it). The top-level cache marker
 *   also caches the conversation so far, which the tool loop resends each call.
 * - Tool choice is left to the model: the current models reject forced tool use.
 * - Thinking is left at the model's default (adaptive); depth is set by effort.
 * - Tool inputs stream as they are generated, so the server validates each
 *   one itself before passing it on (see handleChat).
 * - On models that support it, a refused request is re-run on a fallback
 *   model inside the same call.
 */
export function buildModelParams({ model, effort, messages }: ModelRequest) {
  const fallback = FALLBACK_MODELS.has(model)
    ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
    : {};
  return {
    model,
    max_tokens: MAX_TOKENS,
    output_config: { effort },
    cache_control: { type: 'ephemeral' as const },
    system: [
      { type: 'text' as const, text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
    ],
    tools: TOOL_DEFINITIONS.map((tool) => ({ ...tool, eager_input_streaming: true })),
    messages: messages as Anthropic.Beta.BetaMessageParam[],
    ...fallback,
  };
}

/** Streams one turn from Claude. Throws the SDK's typed errors on failure. */
export async function* streamFromClaude(
  request: ModelRequest,
  apiKey: string,
  signal: AbortSignal,
): AsyncIterable<ModelEvent> {
  // The SDK retries connection errors, 429 and 5xx itself, and only before any of the stream has arrived.
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  const stream = client.beta.messages.stream(buildModelParams(request), { signal });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield { type: 'text', text: event.delta.text };
    }
  }
  const message = await stream.finalMessage();
  yield {
    type: 'end',
    stopReason: message.stop_reason,
    content: message.content,
    usage: {
      input: message.usage.input_tokens,
      output: message.usage.output_tokens,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
      cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

/**
 * A safe, one-line description of a failed model call for the server logs,
 * and whether it is worth trying again. Anthropic's error messages describe
 * the request's settings or the account, never the question or data sent.
 */
export function describeModelError(error: unknown): { log: string; retryable: boolean } {
  if (error instanceof Anthropic.APIConnectionError) {
    return { log: `${error.name}: could not reach the API`, retryable: true };
  }
  if (error instanceof Anthropic.APIError) {
    const status: number = typeof error.status === 'number' ? error.status : 0;
    const detail = error.message.replace(/\s+/g, ' ').slice(0, 300);
    return {
      log: `${error.name} ${status} ${error.type ?? ''} (request ${error.requestID ?? 'unknown'}): ${detail}`,
      retryable: status === 429 || status >= 500,
    };
  }
  // Anything else, including tool input the SDK could not parse as JSON at all.
  return { log: error instanceof Error ? error.name : 'unknown error', retryable: true };
}
