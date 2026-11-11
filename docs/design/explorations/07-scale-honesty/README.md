# Exploration 07: scale honesty

Status: **decided on 11 November 2026: option A, a status line under the grid, with B's readout while scrolling.**

## Problem

The changes grid shows about 25 rows of a schedule with 350,000 activities. A planner must be able to tell, without asking, how many rows the view holds, how many are hidden and why, and where in the list the visible rows are. The UI spec makes the second one a rule: the count of hidden rows is always visible when a view is filtered.

The scrollbar normally answers "where am I", and at this size it stops meaning much. The thumb is at its minimum size however long the list is, and a pixel of travel is hundreds of rows. There is an engineering side too: 350,000 rows at 24px is 8.4 million pixels and a million rows is 24 million, which is beyond the tallest element some browsers will lay out (roughly 17.9 million pixels in Firefox and 33.5 million in Chrome; these figures are from memory and need confirming). So the grid cannot simply be a very tall element in a native scroller, and whatever tells the planner where they are cannot depend on the native scrollbar being proportional.

## Options

All three are on one page, with a switch between a filtered view (4,812 of 350,412), everything (350,412) and a tiny result (12): [options.html](options.html). Run the `design` preview and open `/explorations/07-scale-honesty/options.html`.

| Option | Does well | Does badly |
|---|---|---|
| **A. A status line under the grid** | Always present; exact position in rows; reads as a sentence | Away from the filter that caused the hiding; says nothing about where changes fall |
| **B. Counts beside the filter, and a readout while scrolling** | Cause and effect side by side; a drag becomes precise; uses no height | Nothing says where you are when not scrolling; the readout misses wheel and keyboard users unless shown for them too |
| **C. An overview strip in place of the scrollbar** | Shows the shape of the changes along the schedule; makes the size visible | A second visualisation to build and explain; needs engine support; has nothing to mark in a filtered view; still needs the count in words |

Things the mock made visible:

- A row number column does a lot of quiet work in all three. "Row 120,401" is the most honest statement of position there is.
- A and B are not rivals. A says where you are at rest; B's readout says where you are going while you move.
- C is the most striking and the least necessary. Its value is in the unfiltered view, which is not the default.

## Decision

**Option A, a status line under the grid, with B's readout shown while the grid is scrolling.** Decided by Usman on 11 November 2026 by accepting Claude's recommendation ("use your picks"), without reasons of his own. The reasoning is Claude's: A satisfies the spec's rule in a place that cannot be scrolled away and gives an exact position in rows that does not depend on the scrollbar; the readout covers the moment A is weakest. C is kept as a possible later addition for the unfiltered view.

Built with one change from the mock: the readout appears for any scrolling (wheel, keyboard or dragging the thumb), not only while dragging, since B's stated weakness was that it missed wheel and keyboard users.

## What changed

Nothing yet.
