# D17: The synthetic generator has its own simple scheduler

Date: 10 November 2026. Status: accepted.

## Context

Synthetic XER files need dates, float and progress that are consistent with their logic, or every later feature (diff, trace, health) would be tested on nonsense. The engine's CPM does not exist yet, and the spec wants it validated against the generator's dates.

## Options

1. Have the generator call the engine's CPM. Then the validation compares a thing with itself.
2. Give the generator its own scheduler, written for clarity, and share only the calendar arithmetic.
3. Write dates without scheduling (for example, evenly spaced). Fast, but the files would not be believable schedules.

## Decision

Option 2. `packages/gen/src/schedule.ts` is a plain forward and backward pass. It shares `packages/engine/src/worktime.ts` with the engine; that module is tested on its own against a minute-by-minute count.

The conventions the files follow, which the engine's CPM must reproduce:

- Retained logic. Work cannot be scheduled before the data date.
- Lag is measured on the predecessor's calendar.
- A start falls at the start of a working period and a finish at the end of one (08:00 and 17:00 on the standard calendar).
- A completed activity keeps its actual dates, has no float, and constrains nothing in the backward pass. Its early dates are written equal to its actuals.
- An activity with no incomplete successor may finish as late as the project does.
- Total float is finish float on the activity's own calendar. Free float is never below zero.
- Constraints supported: start on, start on or after, start on or before, finish on, finish on or after, finish on or before. Mandatory constraints and "as late as possible" are not generated.
- Every relationship runs from a lower activity index to a higher one, so the network cannot loop. Loops are tested with hand-made files instead.

How update 02 is scripted:

- Durations grow on several activities that lie on the chain driving `MS-COMPLETE`. `expected.json` lists them. Only activities that drive the next one from their finish are chosen: growing one tied start to start would not delay the milestone. The slip trace found this; an earlier version scripted 67 days of growth for a 49 day slip.
- All other changes (durations, deleted and added activities, constraints, logic) are kept off that chain, so the scripted growth is the main cause of the slip.
- Added relationships join two activities in the same work package where the sequence already held. An earlier version linked activities up to 300 apart, which chained parallel areas together and produced slips of 600 to 700 working days that no driver explained.
- Both updates use different `task_id` values on purpose, so matching has to go by activity code (D4).

## Consequences

- The slip is close to the scripted growth but not always equal: drivers can be on a six day calendar while the milestone counts five day weeks. At seed 42 the slip and growth are 67 and 67 working days at 1K, 82 and 79 at 100K, 92 and 90 at 350K, and 43 and 43 at 1M.
- Matching the generator proves the engine is consistent with these conventions, not that it matches P6. That needs real exports.
- Not generated yet: activity codes, resources, SF relationships, out-of-sequence progress, and actual dates that differ from the plan.
