/**
 * The main thread's handle on the engine worker. Each request returns a
 * promise for its small result. Schedules are transferred in, not copied,
 * so after `load` the caller no longer holds the data.
 */
import type { EngineRequest, EngineResult } from '@slip/engine';
import { getTransferList, type ScheduleData } from '@slip/xer';
import type { EngineMessage, EngineReply } from './engineProtocol.ts';

/** 'cancelled' and 'superseded' are normal: the caller asked for something newer. 'crashed' means the worker is gone. */
export class EngineRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'EngineRequestError';
    this.code = code;
  }
}

export interface RequestOptions {
  /** Requests sharing a key replace earlier ones that have not started, for example 'grid-rows'. */
  supersedes?: string;
  /** Aborting cancels the request if it has not started. */
  signal?: AbortSignal;
}

type ResultOf<T extends EngineRequest['type']> = Extract<EngineResult, { type: T }>;

interface Pending {
  resolve: (result: EngineResult) => void;
  reject: (error: EngineRequestError) => void;
}

export class EngineClient {
  private worker: Worker;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  /** Called when the worker dies. Every request in flight has already been rejected as 'crashed'. */
  onCrash: (() => void) | null = null;

  constructor() {
    this.worker = this.start();
  }

  private start(): Worker {
    const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<EngineReply>) => {
      const reply = event.data;
      const waiting = this.pending.get(reply.requestId);
      if (!waiting) return;
      this.pending.delete(reply.requestId);
      if (reply.ok) waiting.resolve(reply.result);
      else waiting.reject(new EngineRequestError(reply.code, reply.message));
    };
    worker.onerror = () => {
      this.failAll('crashed', 'The engine stopped unexpectedly.');
      this.onCrash?.();
    };
    return worker;
  }

  private failAll(code: string, message: string): void {
    for (const waiting of this.pending.values())
      waiting.reject(new EngineRequestError(code, message));
    this.pending.clear();
  }

  request<T extends EngineRequest['type']>(
    request: Extract<EngineRequest, { type: T }>,
    options: RequestOptions = {},
    transfer: Transferable[] = [],
  ): Promise<ResultOf<T>> {
    const requestId = this.nextId++;
    return new Promise<ResultOf<T>>((resolve, reject) => {
      this.pending.set(requestId, { resolve: resolve as (result: EngineResult) => void, reject });
      const message: EngineMessage = {
        kind: 'request',
        requestId,
        request,
        supersedes: options.supersedes,
      };
      this.worker.postMessage(message, transfer);
      options.signal?.addEventListener(
        'abort',
        () => {
          if (this.pending.has(requestId)) {
            this.worker.postMessage({ kind: 'cancel', requestId } satisfies EngineMessage);
          }
        },
        { once: true },
      );
    });
  }

  /** Hands a schedule to the engine. The caller's copy is emptied by the transfer. */
  load(slot: 'a' | 'b', data: ScheduleData): Promise<ResultOf<'load'>> {
    return this.request({ type: 'load', slot, data }, {}, getTransferList(data));
  }

  /** Resolves true if the worker answers within the time allowed. */
  async ping(timeoutMs = 5000): Promise<boolean> {
    const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs));
    const answer = this.request({ type: 'ping' }).then(
      () => true,
      () => false,
    );
    return Promise.race([answer, timeout]);
  }

  /** Replaces the worker with a fresh, empty one. Schedules must be loaded again. */
  restart(): void {
    this.worker.terminate();
    this.failAll('crashed', 'The engine was restarted.');
    this.worker = this.start();
  }

  dispose(): void {
    this.worker.terminate();
    this.failAll('cancelled', 'The engine was shut down.');
  }
}
