# DeltaCell

## Contract

- **Use for** how far a date moved between two updates, in working days: finish slip, start slip.
- **Do not use for** a duration, a float value or a count. Those are plain numbers. Do not use it for a move measured in calendar days.
- **Props:** `days`: a signed number of working days, or `null` when there is nothing to compare (a new activity).
- **Rules:**
  - Positive is later and is drawn to the right in the warm scale. Negative is earlier, to the left, in the blue scale. The sign and the number are always shown, so colour is never the only signal.
  - The bar is on a fixed square root scale: full length at 40 working days or more. It never rescales to the rows in view, so a bar means the same everywhere.
  - Bars use scale steps 4 and 5 only; the paler steps do not show against the surface.
  - `null` renders an empty cell of the same width. It does not render "0d": no comparison is not the same as no move.
  - Sort and rank by the number, never by the bar.

## Correct

```tsx
<DeltaCell days={67} />   // +67d, full bar to the right
<DeltaCell days={-10} />  // −10d, bar to the left
<DeltaCell days={null} /> // a new activity: empty
```

## Incorrect

```tsx
<DeltaCell days={slipMinutes} />      // minutes, not working days
<DeltaCell days={slip / largestSlip} /> // rescaled to the view
```
