# Exploration 01: showing slip in a grid cell

Status: **options drawn, waiting for Usman's decision.**

## Problem

The changes grid has one column that matters more than the others: how far each activity's finish moved between the two updates. A planner scans it down hundreds of rows to find the worst movers, then reads individual values. The cell has to carry sign, magnitude and direction at a 24px row height, without relying on colour alone, and without turning a grid where more than half the rows have changed into a wall of colour. It also has to cope with rows that have no slip to show: no change, a new activity, a finished one.

## Options

All four are on one page, over the same 17 real rows from the generated 1,000 activity rail pair, with switches for density, the two neutral options and colour-blind views: [options.html](options.html). To view it, run the `design` preview (or `pnpm --filter @slip/web exec vite ../../docs/design`) and open `/explorations/01-slip-in-a-grid-cell/options.html`.

| Option | Does well | Does badly |
|---|---|---|
| **A. Signed number** | Adds nothing to the grid; sign carries direction without colour; narrowest | Magnitude must be read row by row; nothing to scan |
| **B. Number and diverging bar** | Worst rows found by eye; direction is position (right is later), not colour | About 170px wide; the bar needs a scale and a rule for what it is relative to |
| **C. Stepped heat cell** | Strongest scan; no extra width | Fills the grid with colour; pale steps hide small slips; leans hardest on colour |
| **D. Direction glyph and number** | Shape carries direction; little extra width | Five sizes of a small triangle are hard to tell apart; magnitude still comes from the number |

Things the mock made visible that the descriptions did not:

- In option B the bar scale matters more than the bar. Scaled to the largest slip in view, a bar changes length when the planner filters, which is wrong for a mark meant to be compared. A fixed scale (full length at 40 working days or more, the top band of the colour scale) would keep its meaning.
- In option C, dark text only passes contrast on steps 1 to 4 and white text only on step 5, so the text colour has to switch at the top step.
- In every option the "new" row needs its own treatment. A tag was used here; that is a placeholder, not a decision.

## Decision

Not made. This is Usman's to choose.

Claude's recommendation, for what it is worth: **B with a fixed scale**, because finding the worst movers by eye is the job of this column and B is the only option that does it by position, which survives every colour-blind view and greyscale. The width is the price; slip is the subject of the product, so it can have the widest numeric column.

## What changed

Nothing yet.
