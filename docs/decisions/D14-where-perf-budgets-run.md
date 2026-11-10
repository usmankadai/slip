# D14: Performance budgets are enforced loosely in CI and strictly on a recorded machine

Date: 10 November 2026. Status: accepted.

## Context

The budgets in `docs/spec/performance.md` are absolute times. Shared CI runners are slower than a developer laptop and vary from run to run, so an absolute number measured there is neither publishable nor a reliable pass or fail.

## Decision

- **CI, every pull request:** the 100K size only, median of 3 runs, with time budgets doubled. Long tasks and memory are checked at the table values, because they do not depend on machine speed. The job exists to catch regressions.
- **Local, before a phase is called done:** `pnpm perf` runs 100K, 350K and 1M at the table values, median of 5, on a machine whose specification is written into `docs/perf.md` with the commit. These are the published numbers.
- Both run the same suite (`tools/perf`) against a release build served by `vite preview`, never the dev server.

## Consequences

- A change that slows the 1M case but not the 100K case will pass CI. The local run before each phase is the backstop, and is part of the definition of done.
- If CI proves flaky even at twice the budget, record the evidence here before changing the factor.
- Published numbers are tied to one machine. Anyone can reproduce them with `pnpm perf`; the HUD will show a reviewer the numbers on their own machine.
