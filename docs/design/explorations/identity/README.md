# Identity: colour values

Status: **values proposed, waiting for Usman's decision.**

D16 fixed the character of the identity and left the exact values to be chosen "when the tokens are built", subject to contrast and colour-blind checks. This folder holds the proposal and, later, any revision with its reason.

## What is proposed

One page with every value and its checks: [colour-options.html](colour-options.html). Run the `design` preview and open `/explorations/identity/colour-options.html`. Contrast ratios are computed on the page from the values shown.

| Group | Values | Choice to make |
|---|---|---|
| Neutrals A, warm paper | surfaces `#FBFAF7 #F4F2EC #EBE8E0 #DEDACF`, text `#1C1B18 #55524A #6C685D`, borders `#E2DED3 #898477` | A or B |
| Neutrals B, cool stone | surfaces `#FAFAF9 #F2F2F0 #E8E8E5 #DADAD6`, text `#1A1A19 #515150 #686865`, borders `#E0E0DC #848480` | A or B |
| Accent | `#5B3FD6` | accept or change |
| Late, five steps | `#FBE9C9 #F6CF8A #EDA44A #DB6B2C #B8321F`, text `#8F2A12` | accept or change |
| Early, five steps | `#DCEBFA #B3D2F4 #7FB0EA #4C8CDA #1B56A8`, text `#174A91` | accept or change |
| No change | `#B9B5AA` | accept or change |
| Critical | `#9B1C1C` with a diagonal hatch | accept or change |

## What the checks found

- Primary text is above 14:1 on every surface step it is used on; the identity asks for 7:1.
- The first draft of muted text (`#716D62`) and the strong border (`#8C877A`) fell just short on the header step, at 4.22:1 and 2.93:1. Both were darkened until they pass. Muted text is not for use on the hover step.
- Scale steps 1 to 3 are below 3:1 against the surface, so they cannot stand alone as a bar or glyph. They are fills behind dark text. Bars and glyphs use steps 4 and 5.
- Dark text passes on steps 1 to 4, white text on step 5.
- Under deuteranopia and protanopia the violet accent and the deep early blue come close together. The accent must stay out of data cells and Gantt bars.
- Critical red and the top late step are close in every view. D16 already requires a pattern for critical; the hatch is that pattern.

## Decision

Not made. This is Usman's to choose.

Claude's recommendation: **neutrals A**, since it is what D16 describes and it is the option that looks least like other enterprise tools; accept the rest as drawn and revise after seeing them on a real screen.

## What changed

Nothing yet.
