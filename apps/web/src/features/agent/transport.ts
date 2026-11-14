/**
 * Where an answer comes from. Both kinds speak the same events as the agent
 * server (packages/agent events.ts), so the loop and the panel do not know
 * which one they are talking to (decision D22).
 */
import type { AgentEvent } from '@slip/agent';

export interface Message {
  role: 'user' | 'assistant';
  content: unknown;
}

export interface AgentTransport {
  /** True for canned answers. The panel labels them "Scripted answer, not AI". */
  readonly scripted: boolean;
  /** One call: the events for one turn of the assistant. */
  send(messages: readonly Message[], signal: AbortSignal): AsyncIterable<AgentEvent>;
}

const isEvent = (value: unknown): value is AgentEvent =>
  typeof value === 'object' &&
  value !== null &&
  ['text-delta', 'tool-request', 'done', 'error'].includes(
    (value as { type?: unknown }).type as string,
  );

/** Reads a stream of Server-Sent Events, one JSON event per `data:` line. Anything else is skipped. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncIterable<AgentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
          const event: unknown = JSON.parse(line.slice(5).trim());
          if (isEvent(event)) yield event;
        } catch {
          // A malformed line is not an event.
        }
      }
    }
    if (done) return;
  }
}

/** The live assistant, through the agent server on this origin. Not deployed yet. */
export function liveTransport(
  fetchImpl: typeof fetch = fetch,
  url = '/api/agent/chat',
): AgentTransport {
  return {
    scripted: false,
    async *send(messages, signal) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages }),
          signal,
        });
      } catch {
        yield {
          type: 'error',
          code: 'unavailable',
          message: 'The assistant could not be reached.',
          retryable: true,
        };
        return;
      }
      if (
        !response.ok ||
        !response.body ||
        !response.headers.get('content-type')?.startsWith('text/event-stream')
      ) {
        yield {
          type: 'error',
          code: response.status === 429 ? 'unavailable' : 'rejected',
          message:
            response.status === 429
              ? 'The assistant is busy or has reached its limit for now.'
              : 'The assistant would not take the question.',
          retryable: response.status === 429,
        };
        return;
      }
      yield* readEvents(response.body);
    },
  };
}
