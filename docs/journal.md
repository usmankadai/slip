# Build journal

What was built, what Usman decided or designed, and what an agent generated. Newest first.

## 10 November 2026: CPM and the diff of two updates

**Built**

- CPM in `packages/engine`: forward and backward passes in topological order, all four relationship types, lags and leads, constraints, progress, several calendars, and logic loops that are reported instead of hanging.
- The diff: activities matched by code, a bitmask of change kinds per activity, deltas in working minutes, added and removed activities, and relationship changes counted and flagged at both ends.
- Validation: the engine matches the generator on every date and float value in eight generated files, and at 1M activities with zero differences in six million values. The diff finds exactly the changes the generator recorded.
- Rough timings in Node: CPM about 0.36s and diff about 0.96s at 1M activities, against budgets of 3s each.

**Usman decided or designed**

- To begin phase 2's engine work while the phase 1 items that need him (import flow, colours, real files, deploy) are open. This departs from the rule that a phase does not start until the last one is done; it is his call and is recorded here.
- The change kinds, matching by activity code, and the bitmask storage, from the original spec.
- That commits and pull requests no longer credit the agent in git. This journal remains the record of who did what.

**The agent (Claude) generated**

- All code and tests in this entry, and decision D18, including the table of known differences from P6.
- Choices made without asking: how loops are broken, the `DuplicateCode` flag, deltas in working minutes, flagging both ends of a changed relationship, and critical meaning float of zero or less.

**Worth Usman's attention**

- In the synthetic pairs, more than half of all activities count as "changed", mostly because float moves everywhere when completion slips, and about a third have a moved finish. A changes view that shows every changed activity would be mostly noise. This is a design question (which changes are causes and which are consequences), not an engine one.

**Not verified**

- Nothing has been compared with a real P6 export.
- The timings are not from the perf suite and are not in a worker.

## 10 November 2026: security headers and the secrets check

**Built**

- One list of security headers, served by the preview server and repeated in `vercel.json`, with a test that keeps them identical.
- A check that fails the build if a key, or the name of a server-only variable, reaches the browser bundle.
- `vercel.json`, ready for the first deploy: build settings, headers and cache rules.

**Usman decided or designed**

- The security position in the spec: a strict policy with nothing inline, secrets on the server only, and never weakening the policy to make something work.
- The original versions of the headers file, its test and the secrets check, which he wrote for parity. They are ported here with their tests.

**The agent (Claude) generated**

- The port, the extra assertions (no wildcards, cache rules) and the Redis token pattern.

**Not verified**

- Nothing is deployed yet, so `vercel.json` is untested on Vercel. The headers were checked on the local preview server only.
## 10 November 2026: performance suite

**Built**

- `tools/perf`: a Playwright suite against a release build. It imports a synthetic file cold and from the cache, several times, and checks the medians against the budgets in the spec.
- A CI job for the 100K subset, and a writer that updates `docs/perf.md` from a local run.
- First suite results: a full import of one file takes 0.36s at 100K, 1.24s at 350K and 3.66s at 1M; reopening from the cache takes 0.12s, 0.41s and 1.16s. No long tasks on the main thread. All within budget.

**Usman decided or designed**

- The budgets themselves, the rule that they are never loosened to pass, and where they run (strict locally, loose in CI).
- A change to the workflow: the agent opens pull requests, and he merges them and deletes the branches.

**The agent (Claude) generated**

- The suite, the page hook it drives, the results writer and the CI job.
- The planner interview guide draft (its own pull request).

**Limits of these numbers**

- Memory is the main thread only, and there is no engine worker yet, so the memory row will rise.
- "Reopen from cache" stops when the schedule is in hand, not when rows are on screen.
- Chromium only.

## 10 November 2026: import worker and browser cache

**Built**

- A streaming SHA-256 and a binary cache format in `packages/xer`. A cached schedule decodes to views over one buffer, with no per-row work.
- The import worker: hash, look in the cache, otherwise stream through the parser, pack, write to the Origin Private File System, and transfer the result. Progress events at most every 100ms; cancellable.
- A generate worker that produces the same bytes as the CLI, so the browser demo can build its own fixtures.
- A developer harness page to run all of this in a real browser. It is not a designed screen and says so.
- First browser measurements in `docs/perf.md`: a full import of one file takes about 0.4s at 100K, 1.4s at 350K and 4.0s at 1M, with no long tasks on the main thread.

**Usman decided or designed**

- The workflow for the build: finish a step, open a pull request, squash and merge when checks pass, delete the branch, move on.
- The requirements this implements, from the original spec: streaming import in a worker, progress in rows and bytes, transferable buffers, a browser cache keyed by file hash.

**The agent (Claude) generated**

- All code and tests in this entry, and the harness.
- One departure from the spec, made without asking: the file is read twice on a cache miss (hash first, then parse), because a single pass cannot know the hash in time to skip the parse.

**Not verified**

- Only Chromium was tested. Firefox and Safari are untested.
- The numbers are single runs on the development server, not the perf suite.

## 10 November 2026: working-time arithmetic and the synthetic generator

**Built**

- `packages/engine/src/worktime.ts`: calendar arithmetic through one idea, the count of working minutes before a moment. Adding work, snapping to a working period and measuring float are lookups and a binary search, never a loop over days. Tested against a minute-by-minute count.
- `packages/gen`: builds a schedule network (phases, areas, disciplines, three calendars), schedules it, statuses it, and scripts a second update with a known slip. Writes XER in chunks.
- `tools/gen-xer`: the command line wrapper. The 1K rail pair is committed; 100K, 350K and 1M generate locally.
- 68 unit tests in total. The generated files parse with no warnings at every size.

**Usman decided or designed**

- The generator's brief in the original spec: paired updates, `expected.json`, sectors, sizes, determinism, and a scripted slip on a known driving chain.
- To install the GitHub CLI and enable pnpm, and to continue phase 1.

**The agent (Claude) generated**

- All of the code and tests in this entry.
- The scheduling conventions in D17, chosen without asking. They decide what the engine's CPM will be held to, so they are worth a read.
- The shape of the synthetic programme: how activity count maps to phases, areas and disciplines, the mix of relationship types, and the three calendars.

**What went wrong and was fixed**

- The first version linked activities across areas. At 100K the project ran past 80 years; after a first fix, added relationships in update 02 still caused slips of 600 to 700 working days that no scripted driver explained. Links are now local, and an added relationship only joins a sequence that already held.
- A test claimed the slip equals the scripted growth exactly. It does not when drivers and the milestone use different calendars, so the test now allows a small difference and says why.
- The calendar reader dropped a 24 hour day written as 00:00 to 00:00. Fixed, with a test.

**Rough numbers, not for publishing** (Node, Apple M3, parser only, streamed from disk)

- 100K: about 0.3s. 350K: about 0.9s. 1M: about 2.8s. The budgets for a full parse in the browser are 1.5s, 4s and 10s.

**Still not done in phase 1**

- The parse worker, the import screen (waiting on its low-fidelity flow), the browser cache, Storybook and tokens (waiting on colour values), real XER fixtures, the perf harness, the first deploy, and the research guide.

## 10 November 2026: spec, repository and the XER parser

**Built**

- The spec: `CLAUDE.md` as a short entry point, with the detail in `docs/spec/`.
- The monorepo: pnpm workspaces, strict TypeScript, ESLint, Prettier, Vitest, a GitHub Actions workflow, and a placeholder web app that only proves the build.
- `packages/xer`: wall-clock date arithmetic, growable column builders and a shared string table, a reader for P6 calendar data, and a streaming parser that produces the columnar `ScheduleData`. 40 unit tests, including chunked input, windows-1252 text, a zero-copy transfer, the unclean-file cases from the spec, and a small fuzz test.

**Usman decided or designed**

- The product idea, its scope and the original spec: the workflow, the columnar data model, workers, performance budgets, the design system for agents, and the phases.
- To keep the full scope when offered a smaller one.
- To accept the proposed visual identity (D16) as written.

**The agent (Claude) generated**

- The production additions to the spec (persistence, security and privacy, import robustness, deployment, the agent tool loop, evals) and the split into linked files. Usman reviewed and accepted them.
- The design spec (`docs/spec/design.md`), including the visual identity proposal. No alternatives were explored before it was accepted.
- All of the code and tests in this entry, and decisions D1 and D13 as written up.
- Engineering choices made without asking, recorded in D1 and D13: a fixed epoch, one `NONE` marker, extra planned-date columns, structured import warnings, and leaving `noUncheckedIndexedAccess` off.

**Not done yet in phase 1**

- The synthetic generator and fixtures, the parse worker, the import screen (waiting on its low-fidelity flow), the browser cache, Storybook and tokens (waiting on colour values), real XER fixtures, the perf harness, the first deploy, and the research guide.
- Not checked against a real P6 export: the calendar exception day numbering and the `SCHEDOPTIONS` field names.
- Activity codes and resources are not read yet.
