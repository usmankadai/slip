# ProgressBar

## Contract

- **Use for** a job the planner is waiting on that takes more than about a second: reading a file, generating a sample pair.
- **Do not use for** a value in the data (percent complete of an activity). That is a cell, not a progress bar.
- **Props:** `label` (required), `value`, `max`. Leave `value` out when the total is not known; the bar is then indeterminate.
- **Rules:**
  - The label always says what is being done and how far it has got, with units: rows and megabytes, not a bare percentage.
  - The bar is neutral. It never uses the slip colours or the accent.
  - It does not animate between values; a number should never be delayed by motion.

## Correct

```tsx
<ProgressBar value={61} max={84} label="Reading: 252,000 rows · 61 of 84 MB" />
```

## Incorrect

```tsx
<ProgressBar value={0.72} label="72%" /> // no unit, no statement of what is happening
```
