# D1: Columnar typed arrays for schedule data

Date: 10 November 2026. Status: accepted.

## Context

Slip has to hold two schedules of up to 1M activities each and hand them to a worker. One JavaScript object per activity costs memory per object, makes the garbage collector walk millions of objects, and has to be copied (structured clone) to cross a worker boundary.

## Options

1. An array of activity objects. Simple to write; does not scale and cannot be transferred.
2. One typed array per field, indexed by a dense activity index. More awkward to read; compact, fast to scan, and each buffer moves to a worker without copying.
3. A WebAssembly or SQLite-in-the-browser store. Powerful, but a large dependency and a second language for one portfolio project.

## Decision

Option 2. `packages/xer` produces a `ScheduleData` of typed arrays (see `packages/xer/src/types.ts`). Strings live as UTF-8 bytes in one shared table and are decoded only for visible rows. Relationships are stored twice in compressed sparse row form, once by predecessor and once by successor.

Details settled while building it:

- **One "no value" marker**, `NONE` (-2147483648), for every date, duration and float column. Float can be negative and dates before the epoch are negative, so -1 could not be used.
- **Planned ("target") dates are kept** as two extra columns, because the DCMA missed-tasks check and the baseline bars need them.
- **`noUncheckedIndexedAccess` is off.** With it on, every typed array read is `number | undefined` and the hot loops fill with assertions that check nothing. Bounds are covered by tests instead.
- **Calendars are ordinary objects**, not columns. There are tens of them, not millions.

## Consequences

- UI code must never iterate a whole column; it asks for single cells or a visible range.
- Adding a field means adding a column and bumping `FORMAT_VERSION`, which invalidates cached schedules.
- First rough timing, parser only, in Node on an Apple M3 with a simple generated input (not yet the real fixtures or the browser path): about 0.75s for 350K activities and 700K relationships (101MB of text), and about 2.4s for 1M activities and 2M relationships (292MB). Proper numbers come from the perf suite and go in `docs/perf.md`.
