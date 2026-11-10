/** Messages between the main thread and the engine worker. */
import type { EngineRequest, EngineResult, Envelope, Outcome } from '@slip/engine';

export type EngineMessage =
  ({ kind: 'request' } & Envelope<EngineRequest>) | { kind: 'cancel'; requestId: number };

export type EngineReply = Outcome<EngineResult>;
