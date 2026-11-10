/**
 * What the agent endpoint sends and receives. One request is one call to the
 * model: the browser runs any tools the model asks for and posts again with
 * the results (the server keeps no conversation state).
 */

/** Server-sent events on POST /agent/chat. */
export type AgentEvent =
  | { type: 'text-delta'; text: string }
  /** The model wants a tool run. `valid` is false when the input did not fit the tool; answer it with an error result. */
  | {
      type: 'tool-request';
      toolUseId: string;
      name: string;
      input: unknown;
      valid: boolean;
      problem?: string;
    }
  | {
      type: 'done';
      /** tool_use: run the requested tools and post again. end_turn: the answer is complete. */
      stopReason: 'end_turn' | 'tool_use';
      /** The assistant's turn, to append to the message list exactly as given. */
      assistant: unknown[];
      /** Calls to the model so far for this question, including this one. */
      callsUsed: number;
      callsAllowed: number;
    }
  | { type: 'error'; code: AgentErrorCode; message: string; retryable: boolean };

export type AgentErrorCode =
  /** The model service is down, overloaded or rate limiting us. Worth trying again. */
  | 'unavailable'
  /** The model service would not take the request (bad key, no credit, bad request). Trying again will not help. */
  | 'rejected'
  /** The stream broke, or the answer was cut off, after it had started. */
  | 'interrupted'
  /** The model declined to answer. */
  | 'refused';

/** JSON error bodies, for requests refused before any stream starts. */
export type AgentRefusalCode =
  | 'not-configured'
  | 'origin'
  | 'too-large'
  | 'bad-request'
  | 'rate-limited'
  | 'daily-cap'
  | 'step-limit';

export const AGENT_LIMITS = {
  /** Calls to the model for one question. */
  callsPerQuestion: 8,
  bodyBytes: 256 * 1024,
  messages: 120,
  /** One message, as JSON. A tool result is capped far lower by TOOL_LIMITS. */
  messageBytes: 64 * 1024,
  questionCharacters: 2000,
} as const;

interface Turn {
  role: string;
  content: unknown;
}

/** True for a user turn that carries only tool results: part of the question in progress, not a new one. */
export function isToolResultTurn(message: Turn): boolean {
  return (
    message.role === 'user' &&
    Array.isArray(message.content) &&
    message.content.length > 0 &&
    message.content.every((block) => (block as { type?: unknown } | null)?.type === 'tool_result')
  );
}

/** How many times the model has already answered since the user's latest question. */
export function callsForCurrentQuestion(messages: readonly Turn[]): number {
  let calls = 0;
  for (let at = messages.length - 1; at >= 0; at--) {
    const message = messages[at]!;
    if (message.role === 'assistant') calls++;
    else if (message.role === 'user' && !isToolResultTurn(message)) break;
  }
  return calls;
}
