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

## What is built (10 November 2026)

- `tools/perf`: a Playwright suite that builds the app, serves it with `vite preview`, and drives the real import path through `window.slipPerf` (only present when the page is opened with `?perf`).
- `pnpm perf` runs 100K, 350K and 1M at the table values, median of 5, and rewrites the "Latest suite run" section of [docs/perf.md](../perf.md). `pnpm perf:ci` runs 100K at twice the time budgets, median of 3, and is a CI job.
- Measured so far: full import of one file, reopening it from the cache, main thread long tasks, and memory with both updates loaded. The reopen figure is to holding the schedule, because there are no rows to show yet.
- **Memory is measured on the main thread only** (JS heap after a forced collection, plus the typed arrays of both schedules). It will grow when the engine worker holds schedules and derived results, so the budget row is still the starting estimate. Set the real budget once the engine exists.
- Not measured yet at the time: first rows visible, CPM, diff, scroll frame times, the bundle-size budget, and the HUD. All are measured now; see below.

## The grid (11 November 2026)

The changes grid is windowed: only the rows on screen are in the document (about 360 elements in all at 350,000 activities), and it holds a few hundred fetched rows whatever the size of the schedule. The scrolling element is capped at 8,000,000 pixels; above that the scroll position is read as a fraction of the way through the list, so a million rows scroll in the same element.

One hand-run check, not a published number: on the 350,000 activity rail pair, in the development build, in the desktop app's browser pane on the build machine, a three second sweep from the first row to the last held a 95th percentile frame time of 8.4ms on a 120Hz display, and sorting all 350,350 activities by name took about 0.3s. The perf suite does not measure scrolling yet; until it does, the budget row for scroll is unverified.

With the Gantt beside the grid (12 November 2026), the same hand-run sweep on the 350,000 activity pair held a 95th percentile frame time of 8.5ms. The Gantt paints only the rows the grid is showing, about 25 bars a frame, so its cost does not grow with the schedule.

## The HUD and the screens in the suite (15 November 2026)

- **The HUD** (`Shift+P`, ignored while typing in a field) shows activities in update A and B, frame time p50 and p95 over the last 2 seconds, the last engine request and how long it took, the page's JS heap (Chromium only; other browsers say it is not available), and the bytes the two schedules hold in the engine worker. Its code is a separate chunk loaded the first time it is shown. While hidden, nothing of it runs: no animation frame loop, no timers, no requests. The only cost it adds when hidden is two fields set on each engine reply. The sampling pattern is ported from pulse's performance HUD, which had no tests to bring.
- **`tools/perf/src/ui.perf.ts`** drives the real screens: both files dropped on the import screen, the update summary, then the changes grid swept from the first row to the last over 3 seconds with the Gantt beside it. Its fixtures come from `fixtures/synthetic` when present and are generated otherwise, so it runs in CI.
- **"First rows visible after file drop"** is measured as the time from the second file's change event to the first frame in which the summary shows its answer, timed inside the page so Playwright handing the file over is not counted. The app opens on the summary, not the grid, so the summary's answer is the first content a planner sees; the grid's first rows after that are reported on their own.
- **Scroll frame times** are measured with the frame rate not capped to the display (`--disable-gpu-vsync`, `--disable-frame-rate-limit`), so a frame time is Slip's work and not the refresh rate.
- **`tools/perf/src/bundle.perf.ts`** checks the initial JavaScript budget: the entry script and anything it preloads, gzipped. It runs in CI at the budget itself, because it does not vary between runs.

