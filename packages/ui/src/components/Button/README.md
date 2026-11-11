# Button

## Contract

- **Use for** an action the planner takes: choose a file, compare updates, swap.
- **Do not use for** navigation between screens (use a link) or for a choice among options (use `SegmentedControl`, when it exists).
- **Props:** `variant`: `default`, `primary` or `quiet`. Everything else is a native button attribute. `type` defaults to `button`.
- **Rules:**
  - At most one `primary` button is visible on a screen: the next step.
  - The label is a verb phrase in sentence case, with no full stop: "Compare updates", not "OK".
  - A disabled button says why nearby, in text. Do not rely on the disabled look alone.
  - `quiet` is for a secondary action that should not compete: "Cancel", "Replace".

## Correct

```tsx
<Button variant="primary" onClick={compare}>
  Compare updates
</Button>
```

## Incorrect

```tsx
<Button variant="primary">Compare</Button>
<Button variant="primary">Generate a sample pair</Button> // two primary actions
```
