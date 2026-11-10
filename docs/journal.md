# Build journal

What was built, what Usman decided or designed, and what an agent generated. Newest first.

## 10 November 2026: the agent's tools against the engine

**Built**

- The six tools now run against the real engine: search, activity detail, slip trace, health, the comparison summary, and proposing an edit. Each returns a few kilobytes of what was asked for, and the list of activity codes an answer may cite.
- Engine additions the tools needed: what is loaded, one activity in both updates, a filter by activity type, and applying a constraint's type and date as one edit.
- Checked against generated pairs: the trace tool names the scripted drivers first with the right days; the comparison matches the generator's counts; a proposal reports its effect and leaves the schedule untouched.

**Usman decided or designed**

- The six tools and what each is for, the limits on results, and that proposing never applies, from the original spec.

**The agent (Claude) generated**

- All code and tests in this entry.
- Choices made without asking: the exact shape and field names of each tool's result; giving the model working days and not minutes; cutting relationships from an activity's detail until it fits the size limit.

**What went wrong and was fixed**

- Sorting "largest slip first" compared minutes. A 28 day slip on a 24 hour calendar outranked a 67 day slip on an 8 hour one. The engine now has working-day columns for ranking, and the tools and the perf suite use them. This would have been wrong in the grid too.
- A test assumed the completion milestone would be first among moved milestones. Another milestone ties with it; the test now checks the order and that completion is present.

**Not verified**

- The tools have not yet been driven by the live model. The earlier live run used made-up results.

## 10 November 2026: first live run of the agent

**Done**

- Three real questions through the local server, with a script answering tool requests with made-up schedule data. Written up in decision D20.
- It worked end to end: the tool loop, citations, refusing a planted instruction, proposing an edit only when asked, and prompt caching. Eleven model calls cost about $0.12.

**Usman decided or designed**

- To test live, and to pay for it. He added the key and the credit himself.

**The agent (Claude) generated**

- The test script (not committed; it is a throwaway) and the write-up.

**Worth Usman's attention**

- Answers are longer than the prompt asks for, and there can be ten seconds with nothing on screen while the model thinks. Both are design questions for the agent panel and the prompt.

**Not verified**

- The tools returned made-up data, not results from the engine. Only three questions were asked, and not through a browser.

## 10 November 2026: the agent server

**Built**

- A shared package with the agent's six tools, the checks on what the model sends, limits on tool results, and the citation check.
- The server: one streaming endpoint, request validation, a per-visitor limit, a daily cap, an origin check, and the call to Claude. It keeps no conversation state.
- 45 tests, all against a fake model and a fake Redis.

**Usman decided or designed**

- The agent's design in the spec: tools not raw data, a stateless server with the tool loop in the browser, proposals not edits, citations checked not trusted, tool results treated as untrusted, scripted mode as the public default, and the limits.
- The original server code in parity that this is adapted from.

**The agent (Claude) generated**

- All code and tests in this entry, the system prompt, the tool descriptions, and decision D20.
- Choices made without asking: the shape of each tool's input; four events where the spec listed six; the model settings (after checking Anthropic's current guidance); allowing requests through when Redis is down.

**Not verified**

- The server has never been called with a real key. No money has been spent.
- Nothing calls it yet, and it is not deployed.

**Worth Usman's attention**

- The system prompt and the tool descriptions decide how the assistant behaves. They are product copy as much as code, and worth reading: `apps/api/src/prompt.ts` and `packages/agent/src/tools.ts`.

## 10 November 2026: edits in the engine

**Built**

- Apply, preview, revert and list edits on the current update: durations and constraints. An edit reschedules and reports which activities moved and which milestones, biggest move first.
- A preview does everything an edit does and keeps nothing, which is what the proposed-edit card needs to show before a planner approves.
- Rough timings in Node: an edit takes about 0.05s at 100K, 0.16s at 350K and 0.5s at 1M.

**Usman decided or designed**

- That imported data is never changed and edits are an overlay; that every edit reruns CPM; and that the agent may only propose edits, which a person approves. All from the original spec.
- To have this built next, ahead of the screens.

**The agent (Claude) generated**

- All code and tests in this entry.
- Choices made without asking: which four fields can be edited; that relationship edits wait; what an edit is refused for; that the comparison is between two of our own CPM runs; rerunning CPM in full, because it is fast enough; and returning up to 50 moved milestones.

**Not verified**

- Timings are from Node, not the perf suite or a worker.
- Nothing shows edits yet: there is no proposed-edit card and no audit log entry is written, because neither exists.

## 10 November 2026: slip trace and DCMA checks

**Built**

- The slip trace: from a milestone back through its driving predecessors, with a ranked list of what each activity on that path added. On generated pairs it ranks exactly the scripted drivers first, with the scripted growth, and the contributions add up to the slip.
- The DCMA 14-point checks for one update, with the counting rules written out beside the code. Thirteen are assessed; resources are not, because assignments are not read yet.
- Both are available from the engine worker. The activities behind a failed check are a filter on the grid's row request.
- Rough timings at 1M activities in Node: trace under 0.1s, health about 0.05s per update.

**Usman decided or designed**

- The trace and health features, the idea of driving predecessors, attributing slip to an activity's own change against what it inherited, and the DCMA thresholds, from the original spec.
- To build these engine pieces now, ahead of the screens that will show them.

**The agent (Claude) generated**

- All code and tests in this entry, and the counting rules document.
- Choices made without asking: what counts as driving, the contribution kinds, that own duration counts only when the finish drives, and every departure listed in the health rules (how the first and last activities are treated, what check 12 reports, how check 13 picks its float).

**What went wrong and was fixed**

- The trace showed the generator was wrong. One scripted driver was tied to its successor start to start, so its extra duration delayed nothing: 67 days of scripted growth gave a 49 day slip. The generator now only scripts growth on activities that drive from their finish, and the fixtures were regenerated.
- Two test assumptions were wrong and were corrected, not the code: missing-logic counts fall as work completes, and update 01 already has some negative float.

**Worth Usman's attention**

- The trace view is one of the hard design problems in the design spec. The engine now returns a ranked list, the driving network and why each branch ends, so any of the layouts being considered can be built from it.
- On the synthetic files, checks 1, 2, 3, 6 and 7 fail. That is the generator's doing (open ends, leads, lags, high float from open ends) and is useful for a demo, but it is not evidence about real schedules.

**Not verified**

- Nothing has been compared with a real P6 export or with another DCMA tool.

## 10 November 2026: the engine worker

**Built**

- `EngineSession`: holds both schedules and answers requests for CPM, the diff, and the cells of a visible range of rows under a filter and a sort.
- `RequestQueue`: runs one job per turn, cancels waiting requests, and lets a newer request replace an older one for the same view.
- The worker and its client in the web app. Schedules are transferred in, not copied.
- The perf suite now times the engine in a real worker. At 1M activities: CPM 0.38s, diff 1.18s, first rows of "changed, worst slip first" 0.07s, text search 0.06s, sort by code 0.22s, with no long tasks on the main thread.

**Usman decided or designed**

- The worker design in the spec: schedules live in the engine worker, results come back small, cells are computed only when visible, and filter and sort results are cached.
- To carry on with phase 2, to stop crediting the agent in git, and to rewrite the earlier history to match.

**The agent (Claude) generated**

- All code and tests in this entry, and decision D19.
- Choices made without asking: cancel and supersede apply to waiting requests only; one schedule per `load`; the filter set; a cap of 2,000 rows per request; sorting and searching on bytes without decoding strings.

**Not verified**

- "Next rows of the same view" took 0.12s at 1M in the one run measured, slower than the first rows. It should be near zero from the cache. A garbage collection after the diff is the likely cause, but that was not confirmed.
- Chromium only. No real P6 export yet.

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
