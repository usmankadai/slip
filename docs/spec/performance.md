# Performance budgets

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


Measured by `tools/perf` with Playwright on Chromium, release build, with results written to `docs/perf.md` (machine spec recorded). Initial targets; tighten them once real numbers exist, never loosen them to make a run pass without recording why in `docs/decisions/`.

| Metric | 100K | 350K | 1M |
|---|---|---|---|
| First rows visible after file drop | < 1.0s | < 2.5s | < 6s |
| Full parse complete | < 1.5s | < 4s | < 10s |
| Reopen from OPFS cache to first rows | < 300ms | < 600ms | < 1.5s |
| CPM run (worker) | < 300ms | < 1s | < 3s |
| Diff of two updates | < 300ms | < 1s | < 3s |
| Grid + Gantt scroll, p95 frame time | < 16.7ms | < 16.7ms | < 16.7ms |
| Main thread long tasks (> 50ms) during import | 0 | 0 | 0 |
| JS heap + typed array memory after import (both updates) | < 250MB | < 700MB | < 1.8GB |

The memory row is a starting estimate. Measure it in phase 1 (heap plus the summed `byteLength` of every registered buffer), then set the real budget at measured + 20% and record it.

Also budgeted: the initial JavaScript for the app shell is at most 250 KB compressed. The agent panel, narrative export and Sentry are code-split and loaded on demand.

## Where budgets run
Shared CI runners are slow and noisy, so absolute numbers measured there are not trustworthy.

- **CI (every pull request):** the 100K column, with thresholds at twice the table values, plus the long-task and bundle-size checks, which are stable. Its job is to catch regressions, not to produce publishable numbers.
- **Local (`pnpm perf`, before each phase is called done):** all three columns at the table values, on the recorded machine, median of 5 runs. These are the numbers published in `docs/perf.md`.

## Performance HUD
A toggle (`Shift+P`) shows a small overlay: activity count for A and B, frame time (p50 and p95 over the last 2s), last worker round trip, and memory. It is off by default and is part of the demo: it lets a reviewer see the numbers on their own machine. Port it from pulse; it must cost nothing when hidden.
