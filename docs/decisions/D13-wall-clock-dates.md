# D13: Dates are wall-clock integers, never date objects

Date: 10 November 2026. Status: accepted.

## Context

XER dates look like `2026-03-29 01:30` and carry no timezone. JavaScript's date object always applies one. Parsing through it makes results depend on the machine's timezone, and around a daylight saving change it can move a date by an hour or reject an hour that "does not exist". A diff between two updates would then show changes that never happened.

## Decision

- Dates are parsed by hand into whole minutes since a fixed epoch, **2000-01-01 00:00 wall-clock**, using calendar arithmetic (`packages/xer/src/dates.ts`). Formatting is the reverse arithmetic.
- The epoch is fixed, not per project. The spec first said "project epoch", but a fixed one needs no second pass over the file and means two updates always share it, so their dates compare directly.
- `Date` is banned by lint in `packages/xer`, `packages/engine` and `packages/gen`.

## Consequences

- Every day is exactly 1,440 minutes. Tests cover both UK clock changes.
- Int32 minutes cover about 4,000 years either side of the epoch.
- Anything that needs "today" (the today line on the Gantt) must get it in the app and pass it in as a wall-clock integer.
