# D18: What the engine's CPM does, and what it simplifies

Date: 10 November 2026. Status: accepted.

## Context

The engine needs a CPM that scales to a million activities, never hangs on a bad file, and whose differences from P6 are known and written down instead of discovered later.

## Decision

`packages/engine/src/cpm.ts` follows the scheduling conventions in [D17](D17-generator-scheduling-conventions.md). On top of those:

- **Order:** Kahn's algorithm over the relationship arrays. No recursion, so depth is not a limit.
- **Loops:** when the sort stalls, the lowest-numbered activity still waiting is released by ignoring its unmet predecessors, and the sort continues. The result names the released activities and counts the ignored relationships. A looped file therefore schedules, and the loop is reported, as [import robustness](../spec/import-robustness.md) requires.
- **Missing calendar:** the project's default calendar; if there is none, Monday to Friday, eight hours.
- **A calendar with no working time:** scheduled on the fallback hours instead of failing.
- **No data date in the file:** the earliest planned or actual start is used.

Known simplifications, each a place where results can differ from P6:

| Area | What the engine does | What P6 does |
|---|---|---|
| Mandatory start and finish | Treated like "start on" and "finish on": they bound both passes but do not override logic | Can violate logic to hold the date |
| As late as possible | Ignored | Delays the activity to consume free float |
| Level of effort and WBS summary activities | Scheduled as ordinary tasks from their own logic | Dates derive from the activities they span |
| Resource dependent activities | Scheduled on the activity calendar | Scheduled on resource calendars |
| Secondary constraints (`cstr_type2`) | Not read | Applied |
| Progress override and actual dates options | Not supported; retained logic only | Supported |
| Out-of-sequence progress | A started activity keeps its actual start; remaining work waits for its predecessors | Same under retained logic |
| Critical definition | Total float of zero or less | Configurable threshold, or longest path |

## Consequences

- On synthetic files the engine matches the generator on every early date, late date, total float and free float: zero differences in six million values at 1M activities. That shows the two agree on D17, not that either matches P6.
- Each row of the table is a candidate explanation when real exports are compared. That comparison is still to do and needs real files.
- The loop rule is deterministic but arbitrary about which relationship is dropped. The planner is told which activities are involved and should fix the logic at source.
