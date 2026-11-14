# Flows: low-fidelity layouts

Hierarchy only (boxes and labels), one page per screen, reviewed against the planner's question for that screen in [design.md](../../spec/design.md). No screen is built until its layout here is chosen.

To view: run the `design` preview (or `pnpm --filter @slip/web exec vite ../../docs/design`) and open `/flows/import.html` or `/flows/summary.html`.

| Screen | Layouts | Status | Chosen |
|---|---|---|---|
| Import | [import.html](import.html): A two slots side by side, B one ledger with two rows, C one file at a time | Decided 11 November 2026 | A, two slots side by side |
| Update summary | [summary.html](summary.html): A milestones full width with a strip below, B milestones with a rail, C one sentence then the evidence | Decided 11 November 2026 | B, milestones with a rail |
| Changes | [changes.html](changes.html): A grid and Gantt side by side, B grid first with a small timeline in each row, C change types down the left | Decided 11 November 2026 | A, grid and Gantt side by side |
| Slip trace | Not drawn as a layout. [Exploration 03](../explorations/03-trace-view/README.md) has three treatments: A ranked causes, B the driving path, C a waterfall | Decided 12 November 2026 | A leading, B beneath as evidence |
| Health | [health.html](health.html): A what changed first then the rest, B all 14 in DCMA order with the change marked, C checks on the left and the chosen check on the right | Decided 12 November 2026 | A, what changed first |
| Finish update | [narrative.html](narrative.html): A one document with evidence in the margin, B paragraph blocks each with its own evidence, C choose the facts then the words | Waiting for Usman | |

## Decisions

Both were decided by Usman on 11 November 2026 by accepting Claude's recommendation as given ("use your recommendation"), without reasons of his own. The reasoning below is Claude's and should be confirmed or replaced in Usman's words before it goes in the case study.

- **Import: A, two slots side by side**, including the "do these two belong together" line. It is what the spec asks for (two slots), and it keeps each warning beside the file it is about. B is the stronger answer to "can I trust it" and stays the fallback if the import report turns out to need the full width; exploration 08 (import warnings) will show that.
- **Update summary: B, milestones with a rail.** It is the one where the secondary facts are plainly secondary and still on screen. A's strip of three tiles is the dashboard the spec warns against. C's sentence is a good idea that belongs on the Finish update screen.

## Finish update: waiting for a decision

Three layouts drawn on 14 November 2026. Claude's recommendation, a suggestion only: **B, paragraph blocks**. It is the only one where "no claim without evidence" can be kept simply and visibly: each block carries its chips and says whether it is generated or edited, the planner can always get back to the generated text, and a block that contradicts the data is caught in words. A reads better but is much harder to build honestly; C's facts list is a good idea that could later become how blocks are added.

Open whichever is chosen: where the narrative is kept between visits, and whether each edit goes in the audit log. Neither exists yet.

## Health: decision

**Layout A, what changed first, then the rest.** Chosen by Usman on 12 November 2026 ("A, changed first"), on Claude's recommendation and without reasons of his own. The reasoning is Claude's: it is the hierarchy the design spec asks for, it keeps all 14 checks on the page, and each row leads into the changes grid filtered to that check. A line under each check's name says what it counts, taken from layout C.

Settled while building, by Claude, and open to change:

- **Worse and better.** A check is worse if it passed and now fails, or fails in both updates and its figure (the share, the count or the index, whichever the threshold applies to) is further from its threshold. Better is the reverse. A check that passes in both is unchanged whatever its figures did. The first version judged on the count of activities; it was changed after it called Missing logic better while a larger share failed.
- **Not compared.** A check that is reported only, or cannot be assessed in either update, is listed with the rest and never called worse or better.
- When nothing changed, the lead box says so in a sentence and the 14 checks follow in DCMA order.

The states of this screen were not drawn as a low-fidelity page before building; they exist as stories (`Screens/Health`).

## Changes: decisions

Made by Usman on 11 November 2026 by accepting Claude's three recommendations as given ("use your picks"). The reasons are Claude's and need his own words, or a line saying he accepted them, before they go in the case study.

- **Layout A**, grid and Gantt side by side. It is the layout the UI spec names and the one planners expect. Built in two steps: the grid first at full width, then the Gantt beside it once exploration 02 (ghost bars) is done.
- **Density B** ([exploration 06](../explorations/06-density/README.md)) and **scale honesty A with B's scrolling readout** ([exploration 07](../explorations/07-scale-honesty/README.md)).

The Gantt half of this screen follows [exploration 02](../explorations/02-two-schedules-on-one-gantt/README.md), decided on 11 November 2026 as option C: only the difference, with the previous bar drawn in full for the selected activity.

The states of the changes screen were not drawn as a low-fidelity page before the grid was built; they exist as stories (`Screens/Changes`).

## States

| Screen | States | Status |
|---|---|---|
| Import, layout A | [import-states.html](import-states.html): empty, loading, error, populated, populated with warnings, a file that needs an answer, a pair that does not look right | Drawn by Claude on 11 November 2026 and built the same day. Usman chose the report layout; the other open questions below were built as drawn and are still his to change |
| Update summary, layout B | [summary-states.html](summary-states.html): populated, loading, three kinds of empty, error, many milestones, things carried over from import, narrow window | Drawn by Claude on 11 November 2026 and built the same day, on the answers below |

Open questions on the import states, all Usman's:

- How the import report is laid out in the slot: [exploration 08](../explorations/08-import-warnings/README.md).
- Whether two updates with the same data date deserve their own wording. This case is not in the import spec; it was added while drawing.
- Whether loading the same file twice should disable Compare updates. It is drawn that way, as the one exception to "warnings never block"; the spec only says to say so.
- The copy. Every sentence in quotation marks on the page is a first draft.

Decisions on the summary, made by Usman on 11 November 2026. He asked for the agent's best suggestion and answered "go"; the reasons are Claude's and need his own words, or a line saying he accepted them, before they go in the case study.

- **Which milestones lead: every milestone, showing the 20 largest moves.** It works as soon as two files are loaded, with no setup. Letting the planner mark key milestones is probably the better long-term answer, but needs a marking interface and a planner's account of how they choose. If the top 20 on a very large schedule turn out to be internal milestones, the fallback is to list finish milestones and constrained ones first.
- **Which dates: the ones stored in each file.** Those are the dates the planner sees in P6. Slip's own calculation has known simplifications (D18), so leading with it would put numbers on the first screen that cannot be reconciled with P6.
- **Say so when the two disagree.** When Slip's recalculated finish differs from the file for any activity of update B, the summary carries one line saying how many.
- **Late moves before early ones**, as drawn.

Still open, and Usman's: how a milestone that was added, removed or completed this month is shown (left out of this version); and the copy.

Built differently from the drawing, because the screens they lead to do not exist yet: no Trace on a row, no links from the rail, and no navigation bar. The header shows the project and the two data dates, with a way back to import. In the "no milestones" case the latest finish is given as two dates, without a working-day figure.

Not drawn for the summary: the navigation bar, which first appears on this screen; the agent panel; what the critical path line opens.

Not drawn for import: generating a sample pair, returning with a pair already loaded, and narrow windows.
