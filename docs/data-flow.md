# Where your data goes

What Slip sends out of the browser, to whom, and when. This file, the table in [security.md](spec/security.md) and the in-app "Where your data goes" panel must say the same thing. Any change to what leaves the browser updates all three in the same change.

Last checked against the code: 15 November 2026.

## The short version

Your XER files are never uploaded. Slip reads them in your browser and keeps the parsed schedules, your edits and the activity log in your browser's storage on this computer.

The assistant has two modes. In **scripted** mode, the only mode on the public site today, nothing about your schedule leaves the browser. In **live** mode, not deployed yet, your question and the specific rows the assistant asks for to answer it are sent through Slip's server to Anthropic. The server passes them on and does not store them.

## In detail

| Data                                                                     | Stays in your browser                 | Sent to Slip's server  | Sent to Anthropic |
| ------------------------------------------------------------------------ | ------------------------------------- | ---------------------- | ----------------- |
| XER files and parsed schedules                                           | Yes: browser storage (OPFS)           | Never                  | Never             |
| Edits you approved, the activity log, the narrative                      | Yes: browser storage (IndexedDB)      | Never                  | Never             |
| Questions to the assistant, scripted mode                                | Yes                                   | Never                  | Never             |
| Questions to the assistant, live mode                                    | Yes                                   | In transit, not stored | Yes               |
| Rows the assistant asks for, live mode: activity codes, names and dates  | Yes                                   | In transit, not stored | Yes               |
| Error reports                                                            | Not collected yet                     | Never                  | Never             |

What any website receives also applies: the host (Vercel) sees requests for the page and its files, with your IP address, as it would for any site. Those requests carry no schedule content.

## How this is enforced

- The Content Security Policy allows the page to connect only to its own origin (`connect-src 'self'`). A request anywhere else is blocked by the browser. The policy is in `config/securityHeaders.ts`, and a test fails if production's copy differs.
- The assistant panel uses the scripted transport (`apps/web/src/features/agent/scripted.ts`). The live transport exists in code but is not connected to the panel.
- `pnpm check:secrets` fails the build if the bundle contains an API key pattern.

## Not built yet

- The in-app panel and the one-time notice before the first live question (spec: [security.md](spec/security.md)). Exploration 09 draws the options.
- The live assistant, and the setting "Send activity names to the agent".
- Error reporting through Sentry, with its scrubber.
