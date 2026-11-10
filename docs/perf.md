# Performance results

Budgets are in [docs/spec/performance.md](spec/performance.md). This file records what was measured, when, and how.

## 10 November 2026: first browser measurements of the import path (by hand, superseded)

**How these were taken.** By hand, through the developer harness in the app: a worker generates a synthetic rail pair (seed 42), and each file is then imported through the real path (stream, hash, decode windows-1252, parse, pack, write to the browser cache, transfer). One run each, on the Vite development server, in Chromium 152 on an Apple M3 with 8 cores.

**What they are not.** They are not from the `tools/perf` suite (not built yet), not a release build, and not a median of five runs, so they do not yet meet the rules in the spec for published numbers. They also do not include first paint of rows, because there is no grid yet. Treat them as a first reading.

| Per file | 100K | 350K | 1M |
|---|---|---|---|
| File size | 27MB | 93MB | 267MB |
| Hash (SHA-256, streamed) | 0.11s | 0.39s | 1.15s |
| Parse | 0.23s | 0.87s | 2.58s |
| Pack and write to cache | 0.02s | 0.08s | 0.24s |
| **Full import, total** | **0.37s** | **1.35s** | **3.97s** |
| Budget: full parse complete | 1.5s | 4s | 10s |
| **Reopen from cache, total** | not measured | **0.44s** | **1.20s** |
| Budget: reopen from cache to first rows | 0.3s | 0.6s | 1.5s |
| Main thread long tasks during import | 0 | 0 | 0 |

Cache size on disk for both updates: 111MB at 350K and about 320MB at 1M.

**What stands out**

- Reopening from the cache is almost all hashing: 1.14s of the 1.20s at 1M. Reading and decoding the cached schedule takes about 0.07s. A cheaper way to recognise a file would make reopening close to instant; that is a choice to make with numbers from the perf suite, not now.
- Generating the 1M pair in the browser takes about 6s, twice as long as in Node. It is a one-off for the demo, but worth a look.

**Not measured yet:** memory, first rows visible, CPM, diff, scroll frame times, Firefox and Safari.

<!-- perf:start -->
## Latest suite run

Written by `pnpm perf`. Release build served by `vite preview`, headless Chromium, synthetic rail fixtures at seed 42, median of 5 runs.

- Machine: Apple M3, 8 cores, 16GB, darwin 27.2.0 arm64
- Commit: 7f51418

| Per file, median of 5 | 100K | 350K | 1M |
|---|---|---|---|
| File size | 27MB | 93MB | 267MB |
| Hash | 0.11s | 0.38s | 1.18s |
| Parse | 0.22s | 0.79s | 2.49s |
| Pack and write to cache | 0.02s | 0.07s | 0.28s |
| **Full import** | **0.35s** | **1.24s** | **3.98s** |
| Budget | 1.50s, within | 4.00s, within | 10.00s, within |
| **Reopen from cache** | **0.12s** | **0.40s** | **1.23s** |
| Budget | 0.30s, within | 0.60s, within | 1.50s, within |
| Main thread long tasks, worst import | 0 | 0 | 0 |
| JS heap, both updates loaded | 2MB | 2MB | 2MB |
| Typed arrays, both updates loaded | 32MB | 110MB | 317MB |
| **Memory total** | **33MB** | **112MB** | **318MB** |
| Budget (starting estimate) | 250MB, within | 700MB, within | 1800MB, within |
| **CPM, one update, in the worker** | **0.05s** | **0.14s** | **0.38s** |
| Budget | 0.30s, within | 1.00s, within | 3.00s, within |
| **Diff of two updates, in the worker** | **0.07s** | **0.31s** | **1.18s** |
| Budget | 0.30s, within | 1.00s, within | 3.00s, within |
| Hand both schedules to the engine | 0.01s | 0.01s | 0.03s |
| First rows of "changed, worst slip first" | 0.01s | 0.02s | 0.07s |
| Next rows of the same view | 0.00s | 0.00s | 0.12s |
| Text search over all codes and names | 0.01s | 0.02s | 0.06s |
| Sort all activities by code | 0.02s | 0.08s | 0.22s |
| Main thread long tasks while the engine works | 0 | 0 | 0 |
| Generate the pair in the browser | 0.55s | 1.85s | 5.21s |

CPM, diff and the row requests are single runs. Not measured yet: first rows on screen, scroll frame times, Firefox and Safari.
<!-- perf:end -->
