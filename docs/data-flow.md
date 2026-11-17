# Where your data goes

What Slip sends out of the browser, to whom, and when. This file, the table in [security.md](spec/security.md) and the in-app "Where your data goes" panel must say the same thing. Any change to what leaves the browser updates all three in the same change.

Last checked against the code: 15 November 2026.

## The short version

Your XER files are never uploaded. Slip reads them in your browser and keeps the parsed schedules, your edits and the activity log in your browser's storage on this computer.

The assistant has two modes, and the panel says which one is on. In **scripted** mode nothing about your schedule leaves the browser. In **live** mode, which the public site uses when its server is configured for it, your question and the specific rows the assistant asks for to answer it are sent through Slip's server to Anthropic. The server passes them on and does not store them. Before the first live question in a tab, a notice says exactly this, and you can choose scripted answers instead.

## In detail

| Data | Stays in this browser | Sent to Slip's server | Sent to Anthropic |
| --- | --- | --- | --- |
| XER files and parsed schedules | Yes | Never | Never |
| Edits, the activity log and the narrative | Yes | Never | Never |
| Questions to the assistant, live mode | Yes | In transit, not stored | Yes |
| Rows the assistant asks for, live mode: activity codes and dates, and names unless you turn them off | Yes | In transit, not stored | Yes |
| Anything, scripted mode | Yes | Never | Never |
| The page address: the two files' short ids, at most three activity codes, and how the grid is set out | Yes | With each page load, as for any website; not stored by Slip | Never |
| Error reports | Not collected yet | Never | Never |

The parsed schedules are kept in browser storage (OPFS); edits, the activity log and the narrative in IndexedDB. Both stay on this computer until the browser's data for the site is cleared.

What any website receives also applies: the host (Vercel) sees requests for the page and its files, with your IP address and the page address, as it would for any site. The address names the two files by a short id made from their content (the first 12 characters of a SHA-256 hash, and the project number) and can hold up to three activity codes: the one being traced, the one the grid was opened on and the one selected. It can also say how the changes grid is set out, in Slip's own words: its sort column and direction, comfortable density, grid only, and the Gantt's zoom. It never holds activity names, dates or text the planner typed (`apps/web/src/app/urlState.ts`).

## How this is enforced

- The Content Security Policy allows the page to connect only to its own origin (`connect-src 'self'`). A request anywhere else is blocked by the browser. The policy is in `config/securityHeaders.ts`, and a test fails if production's copy differs.
- The assistant is live only when the server's `GET /api/health` says so ([D26](decisions/D26-live-assistant-on-vercel.md)); otherwise it uses the scripted transport (`apps/web/src/features/agent/scripted.ts`), which sends nothing. Before the first live question in a tab, the question is held behind a notice that says what will be sent.
- With "Send activity names to the assistant" off, the tools leave every activity name out of what they return, in the browser, before anything is sent (`packages/agent/src/run.ts`). A test checks that no activity name from either update appears in any tool's result ([D27](decisions/D27-withholding-activity-names.md)).
- `pnpm check:secrets` fails the build if the bundle contains an API key pattern.
- The in-app panel ("Where your data goes", in the footer of every screen) draws its table from `apps/web/src/features/dataflow/flows.ts`. A test fails if the table in this file or in the security spec differs from it.
- The assistant's mode is decided once, in `apps/web/src/features/agent/mode.ts`, and read by both the conversation and the panel.

## Not built yet

- Error reporting through Sentry, with its scrubber.
