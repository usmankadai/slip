# Security and privacy

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


Planlab sells to organisations that ask where their data goes. Slip should be able to answer that question precisely.

## What leaves the browser (keep `docs/data-flow.md` and the in-app panel in step with this)
| Data | Stays in this browser | Sent to Slip's server | Sent to Anthropic |
| --- | --- | --- | --- |
| XER files and parsed schedules | Yes | Never | Never |
| Edits, the activity log and the narrative | Yes | Never | Never |
| Questions to the assistant, live mode | Yes | In transit, not stored | Yes |
| Rows the assistant asks for, live mode: activity codes and dates, and names unless you turn them off | Yes | In transit, not stored | Yes |
| Anything, scripted mode | Yes | Never | Never |
| The page address: the two files' short ids, at most three activity codes, and how the grid is set out | Yes | With each page load, as for any website; not stored by Slip | Never |
| Error reports | Not collected yet | Never | Never |

When error reporting is added (Sentry, with the scrubber), its row becomes: scrubbed events go to Sentry, never to Anthropic. The in-app panel and `docs/data-flow.md` print this same table from `apps/web/src/features/dataflow/flows.ts`; a test fails if they differ.

Do not write "the schedule never leaves the browser" anywhere without the live-mode qualification. The accurate claim is: the files are never uploaded, and in live mode only the rows the agent asks for are sent to answer the question.

- Before the first live question in a session, show a one-time notice saying this, with a link to the data flow panel.
- A setting, "Send activity names to the assistant", defaults to on. When off, tool results replace names with codes only and the agent is told names are withheld. Built on 17 November 2026 as a switch under the question box in live mode; changing it starts a new conversation so earlier rows are not resent ([D27](../decisions/D27-withholding-activity-names.md)).

## Application security
- **Headers:** a strict Content Security Policy with no inline scripts or styles (`default-src 'self'`; `script-src 'self'`; `style-src 'self'`; `worker-src 'self'`; `connect-src 'self'` plus the Sentry ingest host only when configured; `frame-ancestors 'none'`; `object-src 'none'`), plus `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`. One shared list is used by the preview server (so Playwright runs under it) and by production; a unit test fails if they differ. An e2e test asserts there are no CSP violations during the main workflow, including workers and the MSW service worker.
- **Secrets:** `ANTHROPIC_API_KEY`, the Redis token and any other secret are server-only and never `VITE_`-prefixed. `pnpm check:secrets` fails the build if the bundle contains a key pattern or a secret's variable name. `.env` is gitignored; `.env.example` lists every variable with a comment.
- **Untrusted file content:** everything from an XER is rendered as text. Never use `dangerouslySetInnerHTML` with schedule or model content. Agent text is rendered through a small allow-list Markdown renderer (no raw HTML, no images, links shown but not auto-fetched).
- **Exports:** CSV cells that start with `=`, `+`, `-` or `@` are prefixed with a single quote to prevent formula injection. PDF and Markdown exports escape content.
- **Input limits:** the import rejects files over a stated size cap (start at 2GB) and non-XER content, with a clear error ([import robustness](import-robustness.md)).
- **Dependencies:** `pnpm audit` runs in CI and fails on high or critical findings in production dependencies. Dependabot is on.
- **Logs:** no log line, on client or server, contains activity names, questions or tool results.

## What is built (10 November 2026)

- `config/securityHeaders.ts` is the one list of headers. `vite preview` serves it, `vercel.json` repeats it, and a unit test fails if they differ. The same test checks that the policy allows nothing inline, nothing evaluated and no wildcards.
- `pnpm check:secrets` scans the built bundle for key patterns and the names of server-only variables. It is part of `pnpm check` and of the CI build job.
- `vercel.json` also sets the cache rules from [persistence](persistence.md): hashed assets for a year, the page itself never.
- Checked by hand in Chromium against the release build: the import and generate workers and the browser cache all work under the policy, with no violations reported.
- Not yet: an automated end-to-end test that fails on any policy violation (it arrives with the end-to-end suite), `pnpm audit` in CI, Dependabot, and the CSV export rule. Markdown export escapes its content (`escapeMarkdown`) and PDF export writes every string escaped ([D25](../decisions/D25-pdf-without-a-library.md)); both have tests with hostile text.

