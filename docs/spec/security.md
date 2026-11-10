# Security and privacy

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


Planlab sells to organisations that ask where their data goes. Slip should be able to answer that question precisely.

## What leaves the browser (keep `docs/data-flow.md` and the in-app panel in step with this)
| Data | Stays in browser | Sent to Slip's server | Sent to Anthropic |
|---|---|---|---|
| XER files and parsed schedules | Yes | Never | Never |
| Edits, audit log | Yes | Never | Never |
| Agent questions (live mode) | Yes | In transit, not stored | Yes |
| Tool results (live mode): the specific rows the agent asked for, including activity codes, names and dates | Yes | In transit, not stored | Yes |
| Anything, in scripted mode | Yes | Never | Never |
| Error reports (if Sentry is on) | n/a | n/a | Never; scrubbed events go to Sentry |

Do not write "the schedule never leaves the browser" anywhere without the live-mode qualification. The accurate claim is: the files are never uploaded, and in live mode only the rows the agent asks for are sent to answer the question.

- Before the first live question in a session, show a one-time notice saying this, with a link to the data flow panel.
- A setting, "Send activity names to the agent", defaults to on. When off, tool results replace names with codes only and the agent is told names are withheld.

## Application security
- **Headers:** a strict Content Security Policy with no inline scripts or styles (`default-src 'self'`; `script-src 'self'`; `style-src 'self'`; `worker-src 'self'`; `connect-src 'self'` plus the Sentry ingest host only when configured; `frame-ancestors 'none'`; `object-src 'none'`), plus `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`. One shared list is used by the preview server (so Playwright runs under it) and by production; a unit test fails if they differ. An e2e test asserts there are no CSP violations during the main workflow, including workers and the MSW service worker.
- **Secrets:** `ANTHROPIC_API_KEY`, the Redis token and any other secret are server-only and never `VITE_`-prefixed. `pnpm check:secrets` fails the build if the bundle contains a key pattern or a secret's variable name. `.env` is gitignored; `.env.example` lists every variable with a comment.
- **Untrusted file content:** everything from an XER is rendered as text. Never use `dangerouslySetInnerHTML` with schedule or model content. Agent text is rendered through a small allow-list Markdown renderer (no raw HTML, no images, links shown but not auto-fetched).
- **Exports:** CSV cells that start with `=`, `+`, `-` or `@` are prefixed with a single quote to prevent formula injection. PDF and Markdown exports escape content.
- **Input limits:** the import rejects files over a stated size cap (start at 2GB) and non-XER content, with a clear error ([import robustness](import-robustness.md)).
- **Dependencies:** `pnpm audit` runs in CI and fails on high or critical findings in production dependencies. Dependabot is on.
- **Logs:** no log line, on client or server, contains activity names, questions or tool results.
