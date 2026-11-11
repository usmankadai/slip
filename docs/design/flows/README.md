# Flows: low-fidelity layouts

Hierarchy only (boxes and labels), one page per screen, reviewed against the planner's question for that screen in [design.md](../../spec/design.md). No screen is built until its layout here is chosen.

To view: run the `design` preview (or `pnpm --filter @slip/web exec vite ../../docs/design`) and open `/flows/import.html` or `/flows/summary.html`.

| Screen | Layouts | Status | Chosen |
|---|---|---|---|
| Import | [import.html](import.html): A two slots side by side, B one ledger with two rows, C one file at a time | Waiting for Usman | |
| Update summary | [summary.html](summary.html): A milestones full width with a strip below, B milestones with a rail, C one sentence then the evidence | Waiting for Usman | |
| Changes | not drawn | | |
| Slip trace | not drawn | | |
| Health | not drawn | | |
| Finish update | not drawn | | |

## Claude's recommendations

These are suggestions. The choices are Usman's.

- **Import: A**, taking the "do these two belong together" line seriously. It is what the spec asks for (two slots), and it keeps each warning beside the file it is about. B is the stronger answer to "can I trust it" and is worth choosing instead if the report turns out to need the full width; exploration 08 (import warnings) will show that.
- **Update summary: B.** It is the one where the secondary facts are plainly secondary and still on screen. A's strip of three tiles is the dashboard the spec warns against. C's sentence is a good idea that belongs on the Finish update screen.

## Not shown yet

Each layout shows one moment. Before a screen is built it also needs its empty, loading and error states, which will be drawn for the chosen layout only.
