/**
 * Engine worker. Owns both schedules after import (decision D3) and answers
 * requests from the main thread with small results. All of the logic is in
 * @slip/engine; this file only moves messages.
 */
import { EngineSession, RequestQueue, type EngineRequest, type EngineResult } from '@slip/engine';
import type { EngineMessage, EngineReply } from './engineProtocol.ts';

const session = new EngineSession();

const queue = new RequestQueue<EngineRequest, EngineResult>(
  (request) => session.handle(request),
  (outcome) => {
    const reply: EngineReply = outcome;
    self.postMessage(reply, {
      transfer: outcome.ok ? EngineSession.transferList(outcome.result) : [],
    });
  },
);

self.onmessage = (event: MessageEvent<EngineMessage>) => {
  const message = event.data;
  if (message.kind === 'cancel') queue.cancel(message.requestId);
  else queue.push(message);
};
