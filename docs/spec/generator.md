# Synthetic data generator (`packages/gen`, CLI in `tools/gen-xer`)

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


```
pnpm gen-xer --activities 350000 --seed 42 --sector rail --out fixtures/synthetic/rail-350k
```

- Outputs a **pair**: `update-01.xer` and `update-02.xer`, plus `expected.json` (key facts the tests assert on).
- Realistic structure: WBS of phases → areas → disciplines; milestones; mostly FS logic with some SS/FF, some lags, a few leads, some hard constraints, several calendars, activity codes, resources.
- Sectors: `rail`, `highways`, `solar`, `flood` (vocabulary for names and WBS).
- Update 02 applies scripted realistic changes: progress, duration growth on a known driving chain, a few logic changes, new constraints, added and deleted activities. `expected.json` records which milestone slips, by how much, and which activities drive it, so the trace feature can be tested end to end.
- Sizes to ship: 1K (dev), 10K, 100K, 350K, 1M.
- Deterministic for a given seed, in Node and in the browser (same bytes out). Use a seeded generator; never `Math.random` or the current time.

## Delivery to the deployed app
Large XER files cannot be committed or bundled (a 1M-activity pair is expected to be hundreds of megabytes; measure it and record the real sizes in `docs/perf.md`).

- `packages/gen` is pure TypeScript with no Node APIs, so `generate.worker.ts` runs it in the browser. The "bundled synthetic pair" picker generates the chosen size on demand, with a progress bar.
- The generator has two outputs: **XER text** (streamed, used by the CLI and by the "generate, then parse" demo path that exercises the real parser) and **direct `ScheduleData`** (skips text; used for a fast start). The import screen offers both and labels them honestly, so perf claims about parsing always come from the path that really parses.
- Generated pairs are cached in OPFS like any other schedule.
- The 1K pair is committed and bundled, so the app has something to show with zero wait and tests have a stable fixture.

## What is built (10 November 2026)

- `packages/gen` and the `gen-xer` CLI, deterministic by seed, for all four sectors.
- Sizes at seed 42, rail, measured in Node on an Apple M3: 1K (0.3MB per file), 100K (27MB), 350K (93MB), 1M (267MB to 270MB). Generating the 1M pair takes about 3s and writing it about 3s.
- The scheduling conventions the files follow are in [D17](../decisions/D17-generator-scheduling-conventions.md).
- Not yet: the direct-to-`ScheduleData` output, `generate.worker.ts`, activity codes and resources, and the `highways`, `solar` and `flood` fixtures (the generator supports them; only `rail` has been generated).

