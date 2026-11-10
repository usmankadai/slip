import { describe, expect, it } from 'vitest';
import { EngineError, RequestQueue, type Outcome } from '../src/index.ts';

function setup(run: (request: string) => string = (request) => request.toUpperCase()) {
  const replies: Outcome<string>[] = [];
  const turns: (() => void)[] = [];
  const ran: string[] = [];
  const queue = new RequestQueue<string, string>(
    (request) => {
      ran.push(request);
      return run(request);
    },
    (outcome) => replies.push(outcome),
    (work) => turns.push(work),
  );
  /** Runs one turn of the event loop. */
  const turn = () => turns.shift()?.();
  const drain = () => {
    while (turns.length > 0) turn();
  };
  return { queue, replies, ran, turn, drain };
}

describe('RequestQueue', () => {
  it('runs jobs in order, one per turn', () => {
    const { queue, replies, ran, turn, drain } = setup();
    queue.push({ requestId: 1, request: 'a' });
    queue.push({ requestId: 2, request: 'b' });
    expect(ran).toEqual([]);
    turn();
    expect(ran).toEqual(['a']);
    drain();
    expect(replies).toEqual([
      { requestId: 1, ok: true, result: 'A' },
      { requestId: 2, ok: true, result: 'B' },
    ]);
  });

  it('cancels a waiting job without running it', () => {
    const { queue, replies, ran, drain } = setup();
    queue.push({ requestId: 1, request: 'a' });
    queue.push({ requestId: 2, request: 'b' });
    expect(queue.cancel(2)).toBe(true);
    drain();
    expect(ran).toEqual(['a']);
    expect(replies.find((reply) => reply.requestId === 2)).toMatchObject({
      ok: false,
      code: 'cancelled',
    });
  });

  it('cannot cancel a job that has finished or was never queued', () => {
    const { queue, drain } = setup();
    queue.push({ requestId: 1, request: 'a' });
    drain();
    expect(queue.cancel(1)).toBe(false);
    expect(queue.cancel(99)).toBe(false);
  });

  it('replaces waiting jobs that share a key and leaves others alone', () => {
    const { queue, replies, ran, drain } = setup();
    queue.push({ requestId: 1, request: 'rows-1', supersedes: 'grid' });
    queue.push({ requestId: 2, request: 'diff' });
    queue.push({ requestId: 3, request: 'rows-2', supersedes: 'grid' });
    queue.push({ requestId: 4, request: 'gantt-1', supersedes: 'gantt' });
    queue.push({ requestId: 5, request: 'rows-3', supersedes: 'grid' });
    drain();
    expect(ran).toEqual(['diff', 'gantt-1', 'rows-3']);
    expect(
      replies
        .filter((reply) => !reply.ok)
        .map((reply) => [reply.requestId, reply.ok ? '' : reply.code]),
    ).toEqual([
      [1, 'superseded'],
      [3, 'superseded'],
    ]);
    expect(replies.length).toBe(5);
  });

  it('sees a newer request that arrives while a job is running', () => {
    const { queue, ran, turn, drain } = setup();
    queue.push({ requestId: 1, request: 'slow' });
    queue.push({ requestId: 2, request: 'rows-1', supersedes: 'grid' });
    turn(); // 'slow' runs; meanwhile a newer rows request arrives
    queue.push({ requestId: 3, request: 'rows-2', supersedes: 'grid' });
    drain();
    expect(ran).toEqual(['slow', 'rows-2']);
  });

  it('answers a failing job with its error code and keeps going', () => {
    const { queue, replies, drain } = setup((request) => {
      if (request === 'known') throw new EngineError('not-loaded', 'Update A is not loaded.');
      if (request === 'unknown') throw new Error('secret internal detail');
      return 'fine';
    });
    queue.push({ requestId: 1, request: 'known' });
    queue.push({ requestId: 2, request: 'unknown' });
    queue.push({ requestId: 3, request: 'ok' });
    drain();
    expect(replies[0]).toEqual({
      requestId: 1,
      ok: false,
      code: 'not-loaded',
      message: 'Update A is not loaded.',
    });
    // An unexpected error is not passed on word for word.
    expect(replies[1]).toEqual({
      requestId: 2,
      ok: false,
      code: 'failed',
      message: 'The request failed.',
    });
    expect(replies[2]).toEqual({ requestId: 3, ok: true, result: 'fine' });
    expect(queue.pending).toBe(0);
  });
});
