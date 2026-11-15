# Exploration 11: relationship lines on the Gantt

Status: **decided on 15 November 2026: option C, the driving path.**

## Problem

The phase 2 spec asks for relationship lines on the canvas Gantt. In P6 every link is drawn, because the rows are in logic order and linked activities sit near each other. Slip's grid is a window onto a filtered, sorted view of up to a million activities, sorted by finish slip by default. Linked activities are rarely next to each other, and most of an activity's links lead to rows that are not on screen. Drawing every link either makes a tangle of long vertical lines or quietly leaves most links out. The canvas rules also apply: nothing can rest on colour, warm colours mean late and cannot be used for lines, and every fact drawn must also be reachable as text, which the activity drawer's Logic tab already does.

## Options

All three are on one page with 14 rows shaped like the 1,000 activity fixture. One switch sorts by finish slip (the default) or by start; another selects an activity or nothing: [options.html](options.html). Run the `design` preview and open `/explorations/11-relationship-lines/options.html`.

| Option | Does well | Does badly |
| --- | --- | --- |
| **A. Every link between the rows on screen** | What a P6 user expects; works with nothing selected; shows clusters of logic when sorted by start | Sorted by slip it is a tangle that says little; silent about links that leave the screen, which at scale is most of them |
| **B. The selected activity's links only** | Readable in any sort; a dashed stub at the edge says how many links lead off screen; matches the drawer's Logic tab | Nothing drawn until a row is selected; shows links, not why the activity moved |
| **C. The selected activity's links, its driving path, and what changed** | Draws the cause: the driving chain back from the selection is heavy, and links added or removed since update A are labelled in words | The most to read and to build; a removed link points at where an activity used to be; three line weights must stay distinct without colour |

Things the mock made visible:

- The sort decides everything for A. Sorted by start, A looks like a P6 chart; sorted by slip, it does not.
- B and C cost one activity's links per selection, which the drawer already fetches. A needs, every time the view scrolls, the links of every row on screen and where each linked activity sits in the current view. The engine can answer that with an index from activity to row per view, built once per filter and sort.
- C reuses the trace that the drawer already runs for its sentence, so the driving path costs nothing more.
- Off-screen links need words, not only a stub: "1 above" is the placeholder.

## Decision

**Option C: the selected activity's links, its driving path heavy, and the links that changed labelled.** Chosen by Usman on 15 November 2026 ("C, driving path"), accepting Claude's recommendation. The reasons are Claude's, which he accepted.

- It is the only option where the lines answer the question Slip exists for: why did this move.
- It matches the activity drawer (exploration 10, option C), which also leads with what changed and why, and it reuses the same trace.
- A was rejected because the default sort turns it into a tangle and it hides off-screen links. B was kept as the fallback if C proves too busy on the real canvas.
- Nothing is drawn with no row selected.

## What changed

- 15 November 2026: built. Two things the mock did not show. A line between two bars that are both beyond the same edge of the chart is left out, because it would only run along that edge. Off-screen links are gathered into one stub per direction for each visible activity, with words, rather than one per link. Removed links are drawn between the activities as they are in update B.
