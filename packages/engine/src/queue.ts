/**
 * Orders the engine's work. A worker runs one job at a time and cannot be
 * interrupted mid-job, so cancelling and superseding act on jobs that are
 * still waiting:
 *
 * - `cancel` removes a waiting job and answers it as cancelled.
 * - A job pushed with a `supersedes` key replaces any waiting job with the
 *   same key. Scrolling a grid sends many `rows` requests under one key;
 *   only the newest is worth running.
 *
 * One job runs per turn of the event loop, so messages that arrived while
 * a job was running are seen before the next job starts.
 */
export interface Envelope<Request> {
  requestId: number;
  request: Request;
  supersedes?: string;
}

export type Outcome<Result> =
  | { requestId: number; ok: true; result: Result }
  | { requestId: number; ok: false; code: string; message: string };

export class RequestQueue<Request, Result> {
  private waiting: Envelope<Request>[] = [];
  private scheduled = false;
  private readonly run: (request: Request) => Result;
  private readonly reply: (outcome: Outcome<Result>) => void;
  private readonly defer: (work: () => void) => void;

  constructor(
    run: (request: Request) => Result,
    reply: (outcome: Outcome<Result>) => void,
    defer: (work: () => void) => void = (work) => void setTimeout(work, 0),
  ) {
    this.run = run;
    this.reply = reply;
    this.defer = defer;
  }

  push(envelope: Envelope<Request>): void {
    if (envelope.supersedes !== undefined) {
      const kept: Envelope<Request>[] = [];
      for (const other of this.waiting) {
        if (other.supersedes === envelope.supersedes) {
          this.reply({
            requestId: other.requestId,
            ok: false,
            code: 'superseded',
            message: 'A newer request replaced this one.',
          });
        } else {
          kept.push(other);
        }
      }
      this.waiting = kept;
    }
    this.waiting.push(envelope);
    this.schedule();
  }

  /** Cancels a waiting job. Returns false if it has already run, is running, or was never queued. */
  cancel(requestId: number): boolean {
    const at = this.waiting.findIndex((envelope) => envelope.requestId === requestId);
    if (at < 0) return false;
    this.waiting.splice(at, 1);
    this.reply({ requestId, ok: false, code: 'cancelled', message: 'Cancelled.' });
    return true;
  }

  get pending(): number {
    return this.waiting.length;
  }

  private schedule(): void {
    if (this.scheduled || this.waiting.length === 0) return;
    this.scheduled = true;
    this.defer(() => {
      this.scheduled = false;
      const envelope = this.waiting.shift();
      if (envelope) {
        try {
          this.reply({
            requestId: envelope.requestId,
            ok: true,
            result: this.run(envelope.request),
          });
        } catch (error) {
          const known = error as { code?: unknown; message?: unknown };
          this.reply({
            requestId: envelope.requestId,
            ok: false,
            code: typeof known?.code === 'string' ? known.code : 'failed',
            message:
              typeof known?.message === 'string' && typeof known?.code === 'string'
                ? known.message
                : 'The request failed.',
          });
        }
      }
      this.schedule();
    });
  }
}
