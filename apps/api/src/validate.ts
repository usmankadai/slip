/**
 * Checks a chat request before any money is spent on it. The body is a
 * conversation the browser holds and replays, so it is checked every time:
 * shape, sizes, and that the question has not used up its calls.
 */
import { z } from 'zod';
import { AGENT_LIMITS, callsForCurrentQuestion, isToolResultTurn } from '@slip/agent';

/** A user turn is a question (text) or a set of tool results, never anything else. */
const toolResult = z.strictObject({
  type: z.literal('tool_result'),
  tool_use_id: z.string().min(1).max(200),
  content: z.string().max(16 * 1024),
  is_error: z.boolean().optional(),
});
const userText = z.strictObject({
  type: z.literal('text'),
  text: z.string().min(1).max(AGENT_LIMITS.questionCharacters),
});

const userTurn = z.strictObject({
  role: z.literal('user'),
  content: z.union([
    z.string().min(1).max(AGENT_LIMITS.questionCharacters),
    z.array(toolResult).min(1).max(32),
    z.array(userText).length(1),
  ]),
});

/**
 * An assistant turn is passed back exactly as the model produced it,
 * thinking blocks included, so its blocks are only checked for a known type
 * and otherwise left alone.
 */
const ASSISTANT_BLOCKS = ['text', 'thinking', 'redacted_thinking', 'tool_use', 'fallback'] as const;
const assistantTurn = z.strictObject({
  role: z.literal('assistant'),
  content: z
    .array(z.looseObject({ type: z.enum(ASSISTANT_BLOCKS) }))
    .min(1)
    .max(64),
});

const body = z.strictObject({
  messages: z
    .array(z.union([userTurn, assistantTurn]))
    .min(1)
    .max(AGENT_LIMITS.messages),
});

export type ChatMessage = z.infer<typeof body>['messages'][number];

export type Validation =
  | { ok: true; messages: ChatMessage[]; callsUsed: number; newQuestion: boolean }
  | { ok: false; code: 'bad-request' | 'step-limit'; message: string };

const encoder = new TextEncoder();

export function validateChat(input: unknown): Validation {
  const parsed = body.safeParse(input);
  if (!parsed.success)
    return { ok: false, code: 'bad-request', message: 'The request is not a valid conversation.' };
  const { messages } = parsed.data;

  for (const message of messages) {
    if (encoder.encode(JSON.stringify(message)).length > AGENT_LIMITS.messageBytes) {
      return { ok: false, code: 'bad-request', message: 'One of the messages is too large.' };
    }
  }
  if (messages[0]!.role !== 'user' || isToolResultTurn(messages[0]!)) {
    return {
      ok: false,
      code: 'bad-request',
      message: 'A conversation must start with a question.',
    };
  }
  const last = messages[messages.length - 1]!;
  if (last.role !== 'user') {
    return { ok: false, code: 'bad-request', message: 'The last message must be from the user.' };
  }
  // Every tool result must answer a tool call in the turn just before it, and answer all of them.
  for (let at = 0; at < messages.length; at++) {
    const message = messages[at]!;
    const previous = at > 0 ? messages[at - 1]! : null;
    const asked =
      previous?.role === 'assistant'
        ? previous.content
            .filter((block) => block.type === 'tool_use')
            .map((block) => String((block as { id?: unknown }).id))
        : [];
    if (isToolResultTurn(message)) {
      const answered = (message.content as { tool_use_id: string }[]).map(
        (block) => block.tool_use_id,
      );
      if (asked.length !== answered.length || !asked.every((id) => answered.includes(id))) {
        return {
          ok: false,
          code: 'bad-request',
          message: 'Tool results do not match the tools that were requested.',
        };
      }
    } else if (message.role === 'user' && asked.length > 0) {
      return { ok: false, code: 'bad-request', message: 'A requested tool was not answered.' };
    }
  }

  const callsUsed = callsForCurrentQuestion(messages);
  if (callsUsed >= AGENT_LIMITS.callsPerQuestion) {
    return {
      ok: false,
      code: 'step-limit',
      message: `The assistant stopped after ${AGENT_LIMITS.callsPerQuestion} steps on this question.`,
    };
  }
  return { ok: true, messages, callsUsed, newQuestion: !isToolResultTurn(last) };
}
