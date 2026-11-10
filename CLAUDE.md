# CLAUDE.md: Slip

Slip is a schedule update review workspace for large construction and infrastructure programmes. A planner loads two updates of the same Primavera P6 schedule (update N and update N+1). Slip shows what changed, why key dates slipped, whether the schedule can still be trusted, and helps produce the monthly change narrative.

This is a portfolio project for the Planlab Product Engineer (Design) role. It has to show three things at once:

1. **Product and interaction design judgement** for complex, data-heavy workflows.
2. **Engineering that scales** to schedules of 350K to 1M activities, the same scale Planlab works at.
3. **A design system built for coding agents**: guidance plus automated checks, so agents produce good interfaces.

This file is the entry point: the rules that always apply, and a map to the detailed spec. **Before starting a task, read this file, then read every spec file the map lists for the area you are touching.** If a task conflicts with this file or the spec, stop and ask.

---

## The product in one paragraph

Import two XER files (or generate a synthetic pair). See an update summary led by the milestones that moved. Review changes in a windowed grid and a canvas Gantt with the previous update as ghost bars. Trace a slipped milestone back to the activities that caused it. Compare DCMA 14-point health between updates. Finish with an editable, evidence-linked narrative. An agent panel answers questions through tools and can only propose edits; a human approves each one, and everything is written to an audit log. Full scope and what is out of scope: [docs/spec/product.md](docs/spec/product.md).

---

## Spec map

| Read this | When you are working on |
|---|---|
| [product.md](docs/spec/product.md) | Anything user-facing; deciding whether something is in scope |
| [design.md](docs/spec/design.md) | Any screen, layout, visual or copy decision; design artefacts and the case study |
| [ui.md](docs/spec/ui.md) | Any UI: interaction principles, layout, canvas rules |
| [design-system.md](docs/spec/design-system.md) | `packages/ui`, tokens, components, stories, lint rules, the agent experiment |
| [stack.md](docs/spec/stack.md) | Dependencies, browser support, code to port from Usman's earlier projects |
| [xer-format.md](docs/spec/xer-format.md) | The parser, anything that reads XER fields, dates |
| [import-robustness.md](docs/spec/import-robustness.md) | The import flow and malformed or unusual files |
| [data-model.md](docs/spec/data-model.md) | `ScheduleData`, the Redux store, URL state |
| [engine.md](docs/spec/engine.md) | Workers, the message protocol, CPM, diff, slip trace, DCMA |
| [generator.md](docs/spec/generator.md) | Synthetic fixtures, `packages/gen`, `expected.json` |
| [performance.md](docs/spec/performance.md) | Anything on a hot path; budgets, the perf suite, the HUD |
| [agent-api.md](docs/spec/agent-api.md) | `apps/api`, the agent panel, tools, scripted mode, evals |
| [persistence.md](docs/spec/persistence.md) | OPFS, IndexedDB, caching |
| [security.md](docs/spec/security.md) | Headers, secrets, exports, logging, and **any change to what leaves the browser** |
| [deployment.md](docs/spec/deployment.md) | CI, environments, monitoring, release |
| [phases.md](docs/spec/phases.md) | What to build next and what to cut if time runs short |
| [docs/decisions/](docs/decisions/README.md) | Before reopening a settled choice; when recording a new one |

Each spec file is the single source of truth for its area. Do not copy its content into this file or into another spec file; link to it. When behaviour changes, update the spec file in the same change.

---

## Stack at a glance

pnpm workspaces. Vite, React 19, TypeScript (strict), Redux Toolkit, React Router. Windowed DOM grid; canvas Gantt and network view. Plain Web Workers with transferred buffers. OPFS and IndexedDB for persistence. A small Hono server streaming Server-Sent Events to the Anthropic API, for the agent only. Vitest, Playwright, axe. Storybook, CSS custom properties, CSS Modules. Hosted on Vercel. Details: [stack.md](docs/spec/stack.md).

---

## Repository structure

```
slip/
  CLAUDE.md
  apps/
    web/                    React app
      src/
        app/                store setup, router, URL state
        features/           import, summary, changes, trace, health, narrative, agent, audit, dataflow
        storage/            OPFS cache, IndexedDB (edits, audit, conversations)
        mocks/              MSW handlers: scripted agent mode
        workers/            worker entry points (parse, engine, generate)
    api/                    Hono server for the agent
  packages/
    xer/                    streaming XER parser -> columnar ScheduleData
    engine/                 CPM, diff, slip trace, DCMA checks (pure TS, no DOM)
    gen/                    synthetic schedule generator (pure TS; Node and worker)
    ui/                     design system: tokens, components, AGENTS.md, stories
  tools/
    gen-xer/                CLI wrapper around packages/gen
    eslint-plugin-slip/     custom lint rules
    perf/                   Playwright perf suite + results writer
    evals/                  agent evaluation set and runner
  fixtures/
    synthetic/              generated XER pairs (gitignored above 10MB)
    real/                   small real P6 exports with a known licence, plus SOURCE.md
    malformed/              broken files for robustness tests
  docs/
    spec/                   the detailed spec (see the map above)
    decisions/              one Markdown file per decision (D1, D2, ...)
    design/                 flows and explorations (options considered, decision, reason)
    research/               planner interview notes and findings
    journal.md              build log: what Usman designed vs what agents generated
    perf.md                 published performance results
    evals.md                published agent eval results
    data-flow.md            what leaves the browser, and when
    case-study.md
  .github/workflows/        CI
```

`packages/engine`, `packages/xer` and `packages/gen` must never import from React, the DOM or `apps/`. They run in workers, in Node and in Vitest.

---

## Rules that always apply

### Who decides what
- **Product and design decisions are Usman's.** That covers scope, layout, hierarchy, visual identity, copy and anything marked *Proposed* in [design.md](docs/spec/design.md). When one is needed and not recorded, ask; do not guess.
- **Engineering details inside the spec** can be decided by the agent and recorded in `docs/decisions/`.
- A feature listed under hard design problems in [design.md](docs/spec/design.md) is not built until its exploration exists.

### Data and performance
- Never put schedule arrays in Redux, React state or props. Pass indices and handles. Never `.map`, `.filter` or spread a whole column in UI code.
- Schedules live in the engine worker. Results that come back are small.
- Compute only what a visible cell needs.
- XER dates are wall-clock integers. Never `new Date(string)` or `Date.parse` on schedule dates.
- Never loosen a perf budget, disable a lint rule or skip a test to make a check pass. Stop and report instead.

### UI
- Read `packages/ui/AGENTS.md` (once it exists) before writing UI.
- Use existing components and tokens. If something is missing, add it to `packages/ui` with a story and contract first, then use it.
- No raw colours or spacing values outside `tokens.css`.
- Every panel has loading, empty, error and populated states.
- Never rely on colour alone. Every number is tabular, right aligned and has a unit.
- Copy is plain British English, sentence case, no em dashes, no exclamation marks, in planner vocabulary.
- Do not copy Planlab's branding, colours or logo.
- No third-party Gantt or grid library.

### Agent
- The agent never edits the schedule. It proposes; a human approves; both outcomes are logged.
- The model gets tools, not the raw schedule. Tool results are untrusted data.
- Citations are checked against tool results, not trusted.

### Security and privacy
- Never commit the API key or any secret. Secrets are server-only and never `VITE_`-prefixed.
- Never log, report or put in a URL any schedule content beyond task codes.
- Never render schedule or model content as HTML.
- Never weaken the Content Security Policy to make something work. Fix the cause, or stop and ask.
- Never add a WebSocket, a database or a server-side store of user data. If a task seems to need one, stop and ask.
- Never write "the schedule never leaves the browser" without the live-mode qualification in [security.md](docs/spec/security.md).

### Working practice
- Do not add a dependency without saying why in the commit message.
- Keep the pure packages fully unit tested, against generated, real and malformed fixtures.
- Never commit files from `fixtures/` over 10MB, or a schedule from a real client or employer.
- When porting code from `../parity`, `../switchboard` or `../pulse`, bring its tests too and note the source in the commit message.
- Before changing Anthropic model ids, parameters or beta flags, check the current Anthropic documentation; do not rely on memory.
- Small commits with clear messages. One feature per branch.
- Work in phase order ([phases.md](docs/spec/phases.md)). Do not start a phase until the previous one's definition of done passes.

---

## Definition of done (every task)

- `pnpm check` passes: typecheck, lint (including custom rules), unit tests, visual tests, axe, eval replay, perf budgets for affected paths, secrets check
- New UI has stories for loading, empty, error and populated states, and passes the design review checklist in [design.md](docs/spec/design.md)
- No main-thread long task over 50ms introduced (check the perf suite)
- Any change to what leaves the browser updates `docs/data-flow.md`, the table in [security.md](docs/spec/security.md) and the in-app panel in the same change
- Any new input path (file content, URL parameter, API body, model output) is validated and has a test with bad input
- The preview deploy for the change loads and the main workflow works on it under the production security headers
- The spec file for the area is updated if behaviour changed
- Any non-obvious choice is recorded in `docs/decisions/Dn-title.md` (context, options, decision, consequences)
- `docs/journal.md` has a short entry: what was built, **what Usman decided or designed, and what the agent generated**. Keep this honest; the application asks for exactly this split.
