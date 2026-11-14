# D22: Scripted answers come from an in-browser transport, not MSW

Date: 14 November 2026. Status: accepted.

## Context

The agent spec says scripted answers are served by MSW (Mock Service Worker) in the browser, using the same event shapes as the live API, so the UI code path is identical. The reason for MSW was that path: the panel should not know whether an answer is live or scripted.

## Options

1. **MSW**, as written. A service worker intercepts `POST /api/agent/chat` and returns a scripted event stream. Adds a dependency, a service worker file served from the site, and a second network-shaped hop that exists only to be intercepted.
2. **A transport interface.** The loop that asks a question talks to an `AgentTransport` with one method that yields agent events. The live transport fetches the server's stream; the scripted transport produces the same events in the page.

## Decision

Option 2. The thing MSW was for, one code path, is kept: the loop, the tool runner (the real `runTool`, against the real engine), the citation check and the panel are shared, and the two transports emit the same `AgentEvent` values from `packages/agent`. The scripted transport reads the real tool results from the conversation and fills its templates from them, as the spec asks.

## Consequences

- No service worker and no new dependency. The Content Security Policy is unchanged.
- The live transport parses the server's Server-Sent Events and is unit tested with a fake `fetch`. It is not used yet: the agent server is not deployed.
- What MSW would also have tested, the HTTP layer, is not exercised by scripted mode. The live transport's own tests cover parsing; an end-to-end test against the real server is still to do.
- The spec's MSW references are superseded by this record.
