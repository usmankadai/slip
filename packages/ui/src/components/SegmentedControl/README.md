# SegmentedControl

## Contract

- **Use for** choosing exactly one of two to about eight options that should all be visible: density, which kind of change to show.
- **Do not use for** an action (use `Button`), for switching several things on and off independently, or for a long list (use a menu, when it exists).
- **Props:** `label`, `options` (`value` and `label` each), `value`, `onChange`.
- **Rules:**
  - One option is always selected.
  - Labels are one or two words, sentence case.
  - The selected option uses the accent, which is what the accent is for: selection. It is never placed inside a data cell.
  - `label` is required and says what is being chosen; it is read out, not shown.

## Correct

```tsx
<SegmentedControl
  label="Density"
  value={density}
  onChange={setDensity}
  options={[
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
  ]}
/>
```

## Incorrect

```tsx
<SegmentedControl label="Actions" options={[{ value: 'export', label: 'Export' }]} ... /> // an action, and only one option
```
