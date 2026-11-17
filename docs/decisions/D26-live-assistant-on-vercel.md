# D26: The live assistant on the public site

Date: 15 November 2026. Status: accepted.

## Context

The agent server (`apps/api`, D20) and the panel (D22) existed, but the public site could only give scripted answers. Usman chose, on 15 November 2026, to run the live assistant on the public site with limits; to store the limits in Upstash Redis; to set the key and other server settings on Vercel himself; and to allow a few paid test questions.

## Decision

- **Hosting.** The agent server runs as Vercel Functions in the app's own project: `api/health.js` and `api/agent/chat.js` each re-export a Hono app mounted at `/api` (`apps/api/src/vercel.ts`), which `pnpm build` bundles into `api/_agent.mjs` with esbuild because Vercel cannot follow the workspace's TypeScript imports. A single catch-all file (`api/[...path]`) was tried first and matched only one path segment, so `/api/agent/chat` was a 404 in production. Vercel calls its `fetch` handler, which streams. The browser therefore talks only to the app's own origin, and the Content Security Policy is unchanged. `vercel.json` gives `/api` a 60 second limit and turns on request cancellation, so Stop ends a paid generation.
- **Origin check.** The server accepts the configured `APP_ORIGIN` or the origin it is itself served from, so preview deployments work without listing their addresses. A lookalike origin is refused.
- **Mode.** The browser asks `GET /api/health` once per page. Live only on a clear `live: true`; a missing server, an error or anything else means scripted. The conversation and "Where your data goes" read the same answer.
- **The notice.** Before the first live question in a tab, the question is held and a notice says exactly what will be sent, with Send it, Use scripted answers, and Where your data goes. Having read it is kept in `sessionStorage`; without storage it is shown again, which is the safe side.
- **Falling back.** When the server says live answers are off or used up for today (`not-configured`, `daily-cap`), the answer says so in the server's words, the rest of the page uses scripted answers, and a failed live answer to a suggested question offers "Show a scripted answer instead".
- **Answers.** Text the model writes before a tool call is its working, shown while it streams and then taken out of the answer. Answers are drawn from an allow-list: paragraphs, lists, tables and bold, parsed by `answerBlocks` in `@slip/agent` and drawn as elements by `AgentText`. Nothing is read as HTML; links and images stay as the characters written.
- **The model call** was checked against the current Anthropic guidance for `claude-opus-5-5` and left as it was: thinking left adaptive, effort set explicitly (`medium`), no forced tool choice, streamed tool inputs validated on the server, prompt caching on the system prompt and tools, and server-side refusal fallbacks (`fallbacks: "default"`).

## Consequences

- Three paid questions through the app on 15 November 2026 (local server, `claude-opus-5-5`, medium effort): answered in 7 to 9 seconds, each cited only codes the tools returned, and every call after the first read the cached prompt (2,870 to 5,223 tokens).
- Production needs, on Vercel: `AGENT_MODE=live`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-opus-5-5`, `AGENT_EFFORT=medium`, `APP_ORIGIN=https://slip.usmankadai.dev`, `AGENT_DAILY_CALL_CAP=300`, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without them the site stays scripted. A spending limit on the key in the Anthropic console is the final backstop.
- Both were built later: the setting "Send activity names to the agent" ([D27](D27-withholding-activity-names.md)), and numbers right-aligned inside the model's tables (17 November 2026, see the agent API spec).
