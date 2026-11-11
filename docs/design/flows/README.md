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

## States

| Screen | States | Status |
|---|---|---|
| Import, layout A | [import-states.html](import-states.html): empty, loading, error, populated, populated with warnings, a file that needs an answer, a pair that does not look right | Drawn by Claude on 11 November 2026 and built the same day. Usman chose the report layout; the other open questions below were built as drawn and are still his to change |
| Update summary, layout B | [summary-states.html](summary-states.html): populated, loading, three kinds of empty, error, many milestones, things carried over from import, narrow window | Drawn by Claude on 11 November 2026, waiting for Usman's review |

Open questions on the import states, all Usman's:

- How the import report is laid out in the slot: [exploration 08](../explorations/08-import-warnings/README.md).
- Whether two updates with the same data date deserve their own wording. This case is not in the import spec; it was added while drawing.
- Whether loading the same file twice should disable Compare updates. It is drawn that way, as the one exception to "warnings never block"; the spec only says to say so.
- The copy. Every sentence in quotation marks on the page is a first draft.

Open questions on the summary states, all Usman's. The screen is not built until the first two are answered, since they change what it computes:

- **Which milestones lead.** Every milestone; only those the planner marks; or every milestone with finish milestones and constrained ones first. Drawn as every milestone, cut to the 20 largest moves.
- **Which dates the summary uses.** The dates stored in each file, or Slip's recalculated dates. Drawn with the file's dates, as the XER spec says; this means a summary row can disagree with its trace.
- Whether early moves are listed after all late moves (drawn) or mixed in by size.
- How a milestone that was added, removed or completed this month is shown. Not drawn.
- The copy.

Not drawn for the summary: the navigation bar, which first appears on this screen; the agent panel; what the critical path line opens.

Not drawn for import: generating a sample pair, returning with a pair already loaded, and narrow windows.
