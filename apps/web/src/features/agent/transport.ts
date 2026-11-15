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

/**
 * What a refusal before any stream started means for the planner. The server's own words are
 * used: it writes them, and they never contain schedule content.
 */
async function refusal(response: Response): Promise<Extract<AgentEvent, { type: 'error' }>> {
  let body: { code?: unknown; message?: unknown } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // Not JSON: fall back to the status.
  }
  const said = typeof body.message === 'string' ? body.message.slice(0, 300) : '';
  if (body.code === 'daily-cap' || body.code === 'not-configured') {
    return {
      type: 'error',
      code: 'off',
      message: said || 'Live answers are not available now. Scripted answers are.',
      retryable: false,
    };
  }
  if (response.status === 429) {
    return {
      type: 'error',
      code: 'unavailable',
      message: said || 'The assistant is busy or has reached its limit for now.',
      retryable: true,
    };
  }
  return {
    type: 'error',
    code: 'rejected',
    message: 'The assistant would not take the question.',
    retryable: false,
  };
}

/** The live assistant, through the agent server on this origin. */
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
        yield await refusal(response);
        return;
      }
      yield* readEvents(response.body);
    },
  };
}
