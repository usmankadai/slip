# EntityChip

## Contract

- **Use for** a piece of evidence beside a claim: an activity, a kind of change, a health check. Clicking it opens what it names.
- **Do not use for** a filter the planner is setting (use `SegmentedControl`), a status (use a word), or decoration. A chip that opens nothing should not be a chip.
- **Props:** `label`, `onOpen` (required), `kind` (`activity` or `other`), `description`.
- **Rules:**
  - The label is the thing's name as the planner knows it: the activity code exactly as in P6, a check's name.
  - Activity codes are set in the mono typeface so 0 and O, 1 and l are told apart.
  - Give a `description` when the label alone would be read out as a bare code.
  - Chips are neutral. They never carry slip colours or the accent: they name evidence, they are not data.
  - Text from the schedule is rendered as text, never as HTML.

## Correct

```tsx
<EntityChip
  kind="activity"
  label="MS-COMPLETE"
  description="Open activity MS-COMPLETE"
  onOpen={() => openActivity('MS-COMPLETE')}
/>
```

## Incorrect

```tsx
<EntityChip label="+67d" onOpen={() => {}} /> // a number is data, not evidence, and it opens nothing
```
