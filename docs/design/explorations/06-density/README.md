# Exploration 06: density

Status: **decided on 11 November 2026: option B, taller rows, larger text, more padding.**

## Problem

Planners keep this tool open all day and want as many rows on screen as will stay readable, so compact (24px rows, 12px text) is the default and is fixed in the identity. Some people, some screens and some moments (a shared screen in a review meeting) need more room. "Comfortable" is the other setting. The question is what it changes and, as important, what it must never change: if density moves columns, alters what a row contains or rescales a bar, the two settings stop being the same grid.

## Options

All three are on one page, each showing the same eight real rows compact and comfortable: [options.html](options.html). Run the `design` preview and open `/explorations/06-density/options.html`.

| Option | Changes | Does well | Does badly |
|---|---|---|---|
| **A. Taller rows only** | Row height, 24 to 32px | Nothing moves sideways on switching | Text is no easier to read; it only adds air |
| **B. Taller rows, larger text, more padding** | Row height, text 12 to 13px, cell padding 8 to 12px | Easier to read; still one line per activity | Names truncate sooner at the same column widths |
| **C. Two lines per row** | Row height to 40px, and a second line with the WBS path | Uses the height for information | Density changes content; fewest rows; helps only text columns |

Rows that fit in a 720px tall grid: about 29 compact, 21 at 32px, 17 at 40px.

What never changes, in any option: which columns are shown and their widths; number formats and units; the slip bar's scale and thickness; colours and the 11px floor; the Gantt's rows follow the grid's; chrome outside the grid stays one size.

Things the mock made visible:

- B is already what D16 says. The exploration is a check on that, not a blank choice.
- In B the cost is real but small: at these widths one more name in eight truncates.
- C's second line is tempting, but it is really a different feature (showing where an activity sits) wearing density's clothes.

## Decision

**Option B: 32px rows, 13px text, 12px cell padding. Column widths stay as the planner set them.** Decided by Usman on 11 November 2026 by accepting Claude's recommendation ("use your picks"), without reasons of his own. The reasoning is Claude's: B is the only option that makes the grid easier to read, which is what people ask for, and it keeps one line per row. A only adds air. C changes what a row contains, which is a different feature; if where an activity sits matters, that should be a WBS column or grouping.

## What changed

Nothing yet.
