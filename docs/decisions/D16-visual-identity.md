# D16: Visual identity

Date: 10 November 2026 (character), 11 November 2026 (colour values). Status: accepted.

## Context

Slip has to look like a professional planning tool and must not look like Planlab, whose public look is dark navy with peach and deep green and a geometric sans. The identity also has to serve the data: a planner reads slip, float and criticality all day, so the chrome must never be mistaken for a value.

## How it was decided

Both parts were decided by Usman accepting an agent's proposal as given. This is recorded because the case study has to be honest about it.

- **Character, 10 November 2026.** An agent drafted the table in [design.md](../spec/design.md). Usman confirmed it as written. No alternatives were explored first.
- **Colour values, 11 November 2026.** Claude drew two sets of neutrals and one set of everything else, with contrast and colour-blind checks, in [the identity exploration](../design/explorations/identity/README.md), and recommended neutrals A. Usman accepted the recommendation ("use your recommendation") without adding reasons of his own. The reasoning in this record is Claude's.

## Options

- **Neutrals A, warm paper.** Chosen. It is what the character describes, and it is furthest from the cool blue-grey of most enterprise tools.
- **Neutrals B, cool stone.** Rejected. Nearly neutral grey; safer and less distinct. Its values are kept in the exploration.

Only one accent, one late scale and one early scale were drawn. They were accepted, not chosen between.

## Decision

The character is the table in [design.md](../spec/design.md). The colour values are:

| Token group | Values |
|---|---|
| Surfaces 0 to 3 (base, panel, header, hover) | `#FBFAF7` `#F4F2EC` `#EBE8E0` `#DEDACF` |
| Text: primary, secondary, muted | `#1C1B18` `#55524A` `#6C685D` |
| Borders: subtle, strong | `#E2DED3` `#898477` |
| Accent | `#5B3FD6` |
| Late, steps 1 to 5 | `#FBE9C9` `#F6CF8A` `#EDA44A` `#DB6B2C` `#B8321F` |
| Late, as text | `#8F2A12` |
| Early, steps 1 to 5 | `#DCEBFA` `#B3D2F4` `#7FB0EA` `#4C8CDA` `#1B56A8` |
| Early, as text | `#174A91` |
| No change | `#B9B5AA` |
| Critical | `#9B1C1C`, always with a diagonal hatch |

Scale bands, in working days of slip: under 5, 5 to under 10, 10 to under 20, 20 to under 40, 40 or more.

## Rules that come from the checks

These are constraints on use, found by measuring the values. They belong in `packages/ui/AGENTS.md` when it is written.

- Primary text is above 14:1 on every surface it is used on.
- Muted text is not used on the hover surface. A hovered grid row uses the panel surface, not the hover surface.
- Scale steps 1 to 3 are fills behind dark text only. They are below 3:1 against the surface, so a bar or glyph uses steps 4 and 5.
- Dark text on steps 1 to 4, white text on step 5.
- The accent stays out of data cells and Gantt bars. Under deuteranopia and protanopia it comes close to the deep early blue.
- Critical never relies on its colour. It is close to the top late step in every view, so it always carries the hatch.

## Consequences

- `packages/ui/src/tokens.css` is the only place these values appear. The exploration page keeps its own copy as a record of what was looked at.
- The values have not been seen on a real screen. They are to be looked at again once the import screen and the grid exist; any revision goes in the identity exploration with its reason, and this record is updated.
- No dark theme. Token names do not assume light, so one can be added.
