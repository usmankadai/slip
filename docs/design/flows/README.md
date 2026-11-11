# Flows: low-fidelity layouts

Hierarchy only (boxes and labels), one page per screen, reviewed against the planner's question for that screen in [design.md](../../spec/design.md). No screen is built until its layout here is chosen.

To view: run the `design` preview (or `pnpm --filter @slip/web exec vite ../../docs/design`) and open `/flows/import.html` or `/flows/summary.html`.

| Screen | Layouts | Status | Chosen |
|---|---|---|---|
| Import | [import.html](import.html): A two slots side by side, B one ledger with two rows, C one file at a time | Decided 11 November 2026 | A, two slots side by side |
| Update summary | [summary.html](summary.html): A milestones full width with a strip below, B milestones with a rail, C one sentence then the evidence | Decided 11 November 2026 | B, milestones with a rail |
| Changes | not drawn | | |
| Slip trace | not drawn | | |
| Health | not drawn | | |
| Finish update | not drawn | | |

## Decisions

Both were decided by Usman on 11 November 2026 by accepting Claude's recommendation as given ("use your recommendation"), without reasons of his own. The reasoning below is Claude's and should be confirmed or replaced in Usman's words before it goes in the case study.

- **Import: A, two slots side by side**, including the "do these two belong together" line. It is what the spec asks for (two slots), and it keeps each warning beside the file it is about. B is the stronger answer to "can I trust it" and stays the fallback if the import report turns out to need the full width; exploration 08 (import warnings) will show that.
- **Update summary: B, milestones with a rail.** It is the one where the secondary facts are plainly secondary and still on screen. A's strip of three tiles is the dashboard the spec warns against. C's sentence is a good idea that belongs on the Finish update screen.

## Not shown yet

Each layout shows one moment. Before a screen is built it also needs its empty, loading and error states, which will be drawn for the chosen layout only. They are not drawn yet for either screen.
