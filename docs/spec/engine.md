# Workers and the engine

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


## Worker layout
- `parse.worker.ts`: streams the file (`file.stream()` + `TextDecoderStream`), parses line by line, builds columns incrementally, posts progress events (`{ phase, rowsParsed, bytesRead, totalBytes }`) at most every 100ms, and transfers the finished `ScheduleData`.
- `engine.worker.ts`: owns both schedules after import. Runs CPM, diff, trace and DCMA. The main thread asks for results by message; the worker returns **small results** (counts, index lists, values for a visible range) rather than copying whole schedules back.
- `generate.worker.ts`: runs `packages/gen` in the browser to build a synthetic pair on demand and hands the result straight to the engine ([generator](generator.md)).

## Protocol
Typed request/response messages with a `requestId`. Every long job can be cancelled (`{ type: 'cancel', requestId }`). Newer requests for the same view supersede older ones.

```ts
type EngineRequest =
  | { type: 'loadSchedules'; a: ScheduleHandle; b: ScheduleHandle }
  | { type: 'runCpm'; schedule: 'a' | 'b' }
  | { type: 'diff' }
  | { type: 'rows'; schedule: 'a' | 'b'; range: [number, number]; columns: ColumnId[]; filter: FilterSpec; sort: SortSpec }
  | { type: 'trace'; taskCode: string; maxDepth?: number }
  | { type: 'health'; schedule: 'a' | 'b' }
  | { type: 'applyEdit'; patch: EditPatch }
  | { type: 'revertEdit'; editId: string }
  | { type: 'query'; spec: AgentQuery };            // used by agent tools
```

## Failure and recovery
- A worker that throws, is terminated or stops answering (no reply to a ping within 5s while idle) is treated as crashed. The main thread shows an error state with "Reload schedules", restarts the worker, reloads both schedules from the OPFS cache and replays applied edits from IndexedDB.
- Allocation failures (`RangeError` on a large typed array) are caught in the worker and reported as a specific "not enough memory" error that names the file size and suggests closing other tabs. Never fail silently and never leave a spinner running.
- React error boundaries wrap each panel, so one panel failing does not blank the workspace.
- Message handlers on the main thread are batched to one paint per frame (port `raf-batcher.ts` from pulse).

## Lazy, render-driven computation
Follow Planlab's own published lesson: compute only what a visible cell needs.
- The `rows` request computes derived columns (delta vs previous update, float change, etc.) **only for the requested range** and **only for requested columns**. Hidden columns cost nothing.
- Filter and sort results are cached as `Int32Array` index permutations in the worker, keyed by `(filter, sort, schedule version)`. The cache is bounded (least recently used, capped by total bytes) and cleared for a schedule when an edit changes its version.

## CPM
- Forward and backward pass over a topological order (Kahn's algorithm). Detect cycles and report them as import warnings instead of hanging.
- Support FS / SS / FF / SF relationships, lags (including negative lags, which DCMA counts as leads), the data date, actuals for in-progress and complete work, and the constraint types listed in [XER format](xer-format.md).
- Calendar-aware: convert between minutes and working time through the activity's calendar.
- Retained logic only ([XER format](xer-format.md)).
- After an edit, rerun CPM and return only the indices whose dates changed.
- **Validation, two kinds:**
  1. Synthetic fixtures: our CPM output must match the generator's own computed dates exactly. This proves internal consistency only, because we wrote both sides.
  2. Real fixtures (`fixtures/real/`): our CPM output is compared with the dates P6 stored in the file. Publish the match rate and the largest differences in `docs/perf.md`, and explain each class of difference (calendar simplifications, scheduling options) in `docs/decisions/`. Target: at least 99% of activities within one working day on retained-logic files. This is the number that shows the engine is correct.

## Diff
For each activity matched by `task_code`, classify changes into: `added`, `removed`, `startMoved`, `finishMoved`, `durationChanged`, `progressed`, `constraintChanged`, `logicChanged` (relationship added, removed, type changed or lag changed), `floatChanged`, `joinedCriticalPath`, `leftCriticalPath`. One activity can have several. Store as a bitmask `Uint16Array` plus delta columns.

## Slip trace
Given a milestone, find its **driving predecessors**: a predecessor drives when the relationship has zero relationship float in the current update. Walk back recursively. For each activity on the driving chain, attribute slip as its own change (duration growth, late start, new logic, constraint) versus slip inherited from upstream. Return the chain plus a ranked contributor list.

## DCMA 14-point checks
Run on both updates and return per-check `{ value, threshold, pass, offenders: Int32Array }`:

| # | Check | Pass if |
|---|---|---|
| 1 | Missing logic (incomplete tasks with no predecessor or no successor) | ≤ 5% |
| 2 | Leads (negative lags) | 0 |
| 3 | Lags | ≤ 5% of relationships |
| 4 | Relationship types | FS ≥ 90% |
| 5 | Hard constraints | ≤ 5% |
| 6 | High float (> 44 working days) | ≤ 5% |
| 7 | Negative float | 0 |
| 8 | High duration (> 44 working days) | ≤ 5% |
| 9 | Invalid dates (actuals after data date, forecasts before it) | 0 |
| 10 | Resources (tasks with duration but no resource) | report only |
| 11 | Missed tasks (baseline finish passed but not complete) | ≤ 5% |
| 12 | Critical path test | report only (describe method in UI) |
| 13 | CPLI | ≥ 0.95 |
| 14 | BEI | ≥ 0.95 |

Counts exclude completed activities, LOE and WBS summary tasks where DCMA guidance says so. Put the exact counting rules in `packages/engine/src/health/README.md` and unit test each check.

## What is built (10 November 2026)

- **Working time, CPM and diff** in `packages/engine`, as pure functions over `ScheduleData`. CPM rules and known differences from P6 are in [D18](../decisions/D18-cpm-rules-and-simplifications.md).
- **The engine worker.** `EngineSession` holds both schedules and answers `ping`, `load`, `cpm`, `diff` and `rows`; `RequestQueue` orders the work, with cancel and supersede for waiting requests. How this differs from the request list above, and why, is in [D19](../decisions/D19-engine-worker-protocol.md).
- **Rows.** Filters: changed only, any of a set of change kinds, status, critical, and text in the code or name. Sort by any column. Cells are computed only for the rows and columns requested.
- Diff additions to this spec: a `DuplicateCode` flag for second and later activities with a code already seen (left out of matching, neither added nor removed); deltas are in working minutes on the activity's own calendar; a changed relationship flags the activities at both ends; critical means total float of zero or less.
- Timings from the perf suite are in [docs/perf.md](../perf.md). At 1M activities in a worker: CPM about 0.4s and diff about 1.2s, against budgets of 3s each.
- **Slip trace** (`trace.ts`). Walks back from an activity through its driving predecessors and stops at finished work, the data date, a constraint or an activity with no predecessor, saying which. Each activity on that network is then asked what it added of its own; the contributors are ranked in working days. Two refinements to the description above:
  - A relationship drives when it alone reproduces the successor's finish. That is the same idea as zero relationship float, and also covers finish to finish and start to finish.
  - An activity's own duration only counts when its finish is what drives the next activity. One tied start to start can take longer without delaying anything.
- **DCMA checks** (`health/health.ts`), with the counting rules in `packages/engine/src/health/README.md`. Check 10 (resources) is not assessed because resource assignments are not read yet; check 12 is reported only.
- Both are available through the engine session: `trace` (by activity index or code) and `health` (per update). The activities behind a check come from a `rows` request with the `healthCheck` filter.
- Rough timings in Node at 1M activities, not from the perf suite: trace under 0.1s, health about 0.05s per update.
- **Edits** (`edits.ts`), on the current update only. Requests: `applyEdit` (by activity index or code), `revertEdit` and `edits`. How they behave:
  - **Fields:** original duration, remaining duration, constraint type and constraint date. Relationship edits (add, remove, change lag) are not built.
  - **The imported columns are never changed.** The edited schedule is the original plus fresh copies of the four editable columns with every edit applied in order. A revert rebuilds those copies from the original and the edits that remain.
  - **Preview:** `applyEdit` with `preview: true` reschedules, reports, and keeps nothing. This is what a proposed-edit card shows before approval.
  - **What comes back:** the activities whose dates or float changed, the project finish before and after, and up to 50 milestones that moved, biggest first.
  - **Like for like:** the comparison is always between two of our own CPM runs, never with the dates in the file, so the result shows the edit and nothing else. From the first edit or preview, update B is shown on recalculated dates.
  - **Refused, with a reason:** a finished activity, a negative or absurd duration, a duration on a milestone, remaining duration on work that has not started, an unknown constraint type, an unknown field.
  - **Replay:** an edit can be applied under a given id, so saved edits can be put back after a reload.
  - **CPM is rerun in full**, not incrementally. At 1M activities an edit takes about 0.5s in Node, so the incremental version is not needed yet.
- Not yet: relationship edits, agent queries, recovery after a crash, and validation against real exports.
