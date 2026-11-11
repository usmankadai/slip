# Exploration 08: import warnings

Status: **decided on 11 November 2026: option B, grouped by what it means for the answer.**

## Problem

A real P6 export is rarely clean. Reading one, Slip may pad short rows, drop relationships that point at nothing, break logic loops, and more: six kinds of warning in the first version, and on a 350,000 activity schedule easily 3,000 of them. The planner's question on the import screen is "did my files load, and can I trust what loaded?". The report has to answer the second half without alarming (3,012 warnings sounds like a broken file, and usually is not) and without burying (two logic loops among them do change dates). Warnings never block the comparison, and the design spec says they must not be hidden behind a success tick. In layout A the report sits inside a slot about 520px wide.

One constraint from the identity: warm colours mean late. A warning is not a late activity, so the report cannot use amber or red, and there is no other warning colour in the tokens.

## Options

All three are on one page, at the slot's real width, with the same six kinds and a switch between 3,012 warnings, 12 warnings and none: [options.html](options.html). Run the `design` preview and open `/explorations/08-import-warnings/options.html`.

| Option | Does well | Does badly |
|---|---|---|
| **A. One list, largest first** | Simplest; treats every kind alike, so Slip judges nothing | The largest count is the least important. Padded rows lead and logic loops come last: alarming and burying at once |
| **B. Grouped by what it means for the answer** | Leads with what may change dates, however few; says what Slip did about each kind; gives each count its share of the schedule | Slip makes a judgement, and the grouping must be right; tall |
| **C. One sentence in the slot, the report in a drawer** | Short, even slots; a full-width table with room for every column | The detail is a click away, close to hiding it; everything rests on one sentence |

Things the mock made visible:

- Sorting by count is actively wrong here. The kinds that matter most are the rarest.
- A count means little without its scale. "96 relationships" reads very differently beside "0.02% of 498,864".
- With no colour available, the first group in B needs a mark as well as a heading. A small square was used; that is a placeholder.
- With 12 warnings all three options look much the same. The choice only matters at scale.

The grouping in B and C (may change dates, changes what is compared, repaired while reading) is Claude's reading of the import spec. Two of the placements are arguable and need a planner's eye: whether a row with the wrong number of fields can be said to have "no effect on dates", and whether duplicate activity codes belong with dates.

## Decision

**Option B, grouped by what it means for the answer.** Chosen by Usman on 11 November 2026 ("i will choose B"). He gave no reasons; the reasoning recorded here is Claude's and needs his own words, or a line saying he accepted it, before it goes in the case study.

- B is the only option that answers "can I trust what loaded" in the slot itself, without hiding anything behind a click.
- A was rejected because sorting by count puts the least important kind first. C was rejected because the detail is a click away.

Not decided, and built as Claude drew them:

- The grouping itself. The parser reports 17 kinds of warning, not the six in the mock; all 17 are placed in one of the three groups in `apps/web/src/features/import/warnings.ts`. That placement is a judgement about planning made without a planner.
- The square mark on the first group, which is still a placeholder.
- C's full-width table for Export and the audit log. Neither exists yet.

## What changed

- 11 November 2026: built as the import report on the import screen. Two differences from the mock: logic loops are not in the report, because they are found when dates are calculated and not when the file is read; and a kind with no examples cannot be opened.
