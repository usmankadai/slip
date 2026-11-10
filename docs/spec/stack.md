# Tech stack

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


- **Monorepo:** pnpm workspaces
- **Web app:** Vite, React 19, TypeScript (strict), Redux Toolkit, React Router
- **Rendering:** windowed DOM for the grid; **canvas** for Gantt bars, relationship lines and the network view (see decision D2)
- **Workers:** plain Web Workers via `new Worker(new URL(...), { type: 'module' })`; Comlink is allowed for the RPC layer. Buffers are **transferred**, not shared: no `SharedArrayBuffer`, so the app does not need cross-origin isolation headers.
- **Browser storage:** Origin Private File System (OPFS) for parsed schedule buffers; IndexedDB for edits, the audit log and conversation history ([persistence](persistence.md))
- **API (agent only):** small Node server using Hono, streaming Server-Sent Events, calling the Anthropic API with `@anthropic-ai/sdk`. The API key lives only on the server, in `.env`, never in the client bundle. Request bodies are validated with zod.
- **Shared rate limit store:** Upstash Redis over its REST API with plain `fetch` (no SDK). Optional: without it the limiter falls back to memory and says so in the logs.
- **Mocking:** MSW serves the scripted agent mode in the browser and the API in tests
- **Testing:** Vitest (unit), Playwright (e2e, visual regression, performance), `@axe-core/playwright` (accessibility)
- **Design system:** Storybook, CSS custom properties for tokens, CSS Modules for component styles
- **Monitoring:** Sentry, off unless a DSN is set, loaded with a dynamic import, with a scrubber ([deployment](deployment.md))
- **Lint and format:** ESLint (flat config) with custom rules in `tools/eslint-plugin-slip`, Prettier
- **Hosting:** Vercel: the web app as a static build, `apps/api` as a function. Preview deploy for every pull request.

**Browser support:** Chromium (Chrome and Edge, current and previous version) is the measured target for all budgets. Firefox and Safari must load, import and render the 100K fixture correctly; they are smoke tested, not budgeted. If a required API is missing (OPFS, module workers, `TextDecoderStream`), show a clear unsupported-browser state, never a blank page.

Do not add a dependency without saying why in the PR or commit message. Do not add a third-party Gantt or grid library (Planlab replaced DHTMLX Gantt for being slow and hard to extend; the point of this project is to build it properly).

## Code to port from Usman's earlier projects
These already exist, are tested, and should be adapted, not rewritten. They live in sibling folders of this repo (`../parity`, `../switchboard`, `../pulse`). Copy the code in; do not import across repos.

| From | What | Use in Slip |
|---|---|---|
| `parity/api/_lib/claudeStream.ts` | Anthropic streaming call, safe error descriptions | Base of the agent model call (extend for tools) |
| `parity/api/_lib/handleAsk.ts` | Handler with the model call injected as a dependency | Same shape, so the handler is tested without a key |
| `parity/api/_lib/rateLimit.ts` | Sliding-window limiter | Keep the interface; add the Redis-backed store |
| `parity/scripts/check-bundle-secrets.ts` | Fails the build if a key reaches the bundle | `pnpm check:secrets` |
| `parity/config/securityHeaders.ts` | CSP and security headers, with a test that preview and production match | [security and privacy](security.md) |
| `parity` ADR 0004 and 0007 | Retry only before the first chunk; scripted fallback; citations checked, not trusted | [agent API](agent-api.md) |
| `switchboard/.github/workflows/ci.yml` | CI layout: checks, e2e with axe, budgets, traces on failure | [deployment](deployment.md) |
| `switchboard/lib/monitoring/*` | Sentry options and scrubber | [deployment](deployment.md) |
| `switchboard` funnel store | Upstash Redis over `fetch` with a memory fallback | Rate limit store |
| `pulse/src/lib/engine/raf-batcher.ts` | Batches updates into one paint per frame | Scroll and worker result handling |
| `pulse/src/components/performance-hud.tsx` | On-screen performance readout | [performance budgets](performance.md) |
