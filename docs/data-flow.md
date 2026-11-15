# Where your data goes

What Slip sends out of the browser, to whom, and when. This file, the table in [security.md](spec/security.md) and the in-app "Where your data goes" panel must say the same thing. Any change to what leaves the browser updates all three in the same change.

Last checked against the code: 15 November 2026.

## The short version

Your XER files are never uploaded. Slip reads them in your browser and keeps the parsed schedules, your edits and the activity log in your browser's storage on this computer.

The assistant has two modes. In **scripted** mode, the only mode on the public site today, nothing about your schedule leaves the browser. In **live** mode, not deployed yet, your question and the specific rows the assistant asks for to answer it are sent through Slip's server to Anthropic. The server passes them on and does not store them.

## In detail

| Data | Stays in this browser | Sent to Slip's server | Sent to Anthropic |
| --- | --- | --- | --- |
| XER files and parsed schedules | Yes | Never | Never |
| Edits, the activity log and the narrative | Yes | Never | Never |
| Questions to the assistant, live mode | Yes | In transit, not stored | Yes |
| Rows the assistant asks for, live mode: activity codes, names and dates | Yes | In transit, not stored | Yes |
| Anything, scripted mode | Yes | Never | Never |
| The page address: the two files' short ids and at most two activity codes | Yes | With each page load, as for any website; not stored by Slip | Never |
| Error reports | Not collected yet | Never | Never |

The parsed schedules are kept in browser storage (OPFS); edits, the activity log and the narrative in IndexedDB. Both stay on this computer until the browser's data for the site is cleared.

What any website receives also applies: the host (Vercel) sees requests for the page and its files, with your IP address and the page address, as it would for any site. The address names the two files by a short id made from their content (the first 12 characters of a SHA-256 hash, and the project number) and can hold up to two activity codes: the one being traced and the one the grid was opened on. It never holds activity names, dates or text the planner typed (`apps/web/src/app/urlState.ts`).

## How this is enforced

- The Content Security Policy allows the page to connect only to its own origin (`connect-src 'self'`). A request anywhere else is blocked by the browser. The policy is in `config/securityHeaders.ts`, and a test fails if production's copy differs.
- The assistant panel uses the scripted transport (`apps/web/src/features/agent/scripted.ts`). The live transport exists in code but is not connected to the panel.
- `pnpm check:secrets` fails the build if the bundle contains an API key pattern.
- The in-app panel ("Where your data goes", in the footer of every screen) draws its table from `apps/web/src/features/dataflow/flows.ts`. A test fails if the table in this file or in the security spec differs from it.
- The assistant's mode is one constant, `apps/web/src/features/agent/mode.ts`, read by both the conversation and the panel.

## Not built yet

- The one-time notice before the first live question (spec: [security.md](spec/security.md)). It arrives with the live assistant.
- The live assistant, and the setting "Send activity names to the agent".
- Error reporting through Sentry, with its scrubber.
