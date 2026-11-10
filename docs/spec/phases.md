# Build phases

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


Work in this order. Do not start a phase until the previous phase's definition of done passes. **The app is deployed from the end of week 1 and stays deployed**, so there is always a working link, and deployment problems (headers, workers, storage) surface early rather than in week 4.

**Design work runs alongside every phase**, and is listed with its timing in the artefacts table in [design.md](design.md). The short version: identity, low-fidelity flows and a public Storybook in phase 1; each exploration written before the feature it concerns is built; a usability session on the working build in phase 3; Storybook written pages and the case study in phase 4.

**Phase 1: Foundations and data (week 1)**
- Monorepo, lint, test and Storybook setup; CI workflow; first deploy to Vercel with security headers and `check:secrets`
- `packages/gen` and the `gen-xer` CLI with 1K, 10K, 100K, 350K, 1M pairs and `expected.json`
- Streaming XER parser in a worker, columnar `ScheduleData`, transfer list, encode and decode, progress events
- Import screen with progress (rows and bytes) and an import report (warnings, counts); the robustness cases in [import robustness](import-robustness.md)
- OPFS cache for parsed schedules
- Collect real XER fixtures with known licences
- Perf harness measuring parse time and memory; set the real memory budget
- Research: interview guide in `docs/research/`, notes from planner calls as they happen

**Phase 2: Engine and the main view (week 2)**
- CPM, diff, engine worker protocol with cancellation and crash recovery
- CPM validation against real fixtures, with the match rate published
- Windowed grid with configurable columns and lazy derived columns
- Canvas Gantt with baseline ghost bars, critical path, relationship lines, zoom, synced scroll, and the canvas rules in [UI principles](ui.md)
- URL state
- Performance HUD
- Publish first numbers in `docs/perf.md`

**Phase 3: The review workflow (week 3)**
- Update summary screen
- Slip trace (list and focused network view), matching `expected.json`
- DCMA health comparison with click-through to offenders
- Activity drawer
- Finish update: narrative generation from diff and trace data (template-based first, agent-polished optional), Markdown and PDF export
- Audit log and edits persisted in IndexedDB; revert
- In-browser fixture generation in the import picker

**Phase 4: Agent panel and design system (week 4)**
- Agent API with the stateless tool loop, limits, rate limit with the Redis store and the global cap
- Streaming panel, mention input, proposed edit flow with CPM rerun and audit entries, citation checking
- Scripted mode over MSW; data flow panel and first-use notice
- Evals: question set, replay in CI, one live run with the report committed
- `packages/ui/AGENTS.md`, component contracts, custom lint rules, visual and axe suites, perf budgets in CI
- Sentry with the scrubber
- Agent comparison experiment
- Case study and demo recording

**If time runs short**, cut in this order and record each cut in the journal: dark theme, PDF export (keep Markdown), the focused network view in the trace (keep the ranked list), agent charts, the 1M budget column (keep 350K). Never cut: the deployed link, scripted mode, the audit log, the accessibility checks, or the honesty of the published numbers.
