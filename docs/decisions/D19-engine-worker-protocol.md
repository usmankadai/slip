# D19: How the engine worker takes requests

Date: 10 November 2026. Status: accepted.

## Context

The spec asks for typed requests with an id, cancellation of long jobs, and newer requests for the same view superseding older ones. A worker runs one piece of JavaScript at a time: while CPM is running it cannot receive a cancel message, so "cancel a running job" would need every algorithm to stop and yield at intervals.

## Options

1. Make every engine job yield regularly so it can be interrupted. Slower, and every algorithm has to be written around it.
2. Cancel and supersede jobs only while they are waiting; let a started job finish.
3. Terminate and restart the worker to cancel. Loses both schedules and every cached view.

## Decision

Option 2. The measurements made it an easy call: the longest job, the diff at 1M activities, takes about 1.2s, and CPM about 0.4s. Nothing runs long enough to need interrupting.

- All logic is in `packages/engine`: `EngineSession` (state and requests) and `RequestQueue` (ordering). Both run and are tested in Node. `engine.worker.ts` only moves messages.
- One job runs per turn of the event loop, so messages that arrived during a job are seen before the next starts.
- A request may carry a `supersedes` key. A newer request with the same key replaces any waiting one, which is answered as `superseded`. Scrolling sends many `rows` requests under one key.
- `cancel` removes a waiting request and answers it as `cancelled`. A job that has started completes.
- Schedules are transferred to the worker, not copied. After `load`, the main thread no longer holds the data.
- Errors reach the main thread as a short code and a safe message. Unexpected errors are not passed on word for word.

Differences from the request list first written in the spec:

- `load` takes one schedule per request and the data itself, not a pair of handles. Loading from the cache by hash, for crash recovery, is still to do.
- A view is a filter and a sort. It is kept as one `Int32Array` of activity indices, least recently used first out, capped at 64MB in total, and dropped when either schedule's version changes.
- `rows` returns at most 2,000 rows per request.
- Text sorting and searching compare UTF-8 bytes in the string table, so no strings are decoded to sort or search a million rows. Search ignores case for A to Z only.

## Consequences

- If a job ever does take many seconds (a trace over a huge network, say), it will need option 1 for that job alone.
- A superseded or cancelled request rejects on the main thread. Callers must treat those two codes as normal, not as errors to show.
- Not built yet: `trace`, `health`, `applyEdit`, `revertEdit`, `query`, reloading from the cache after a crash, and the ping watchdog (the client can ping; nothing calls it on a timer).
