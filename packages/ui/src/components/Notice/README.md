# Notice

## Contract

- **Use for** a message that stays until the situation changes: the result of a check, a warning about a file, a question that must be answered.
- **Do not use for** something that disappears on its own (that is a `Toast`, when it exists) or for an empty panel (`EmptyState`).
- **Props:** `children` (required), `tone`: `plain` or `attention`, `title`, `action`.
- **Rules:**
  - Write full sentences that say what Slip checked or did, then what to do next.
  - `attention` is marked by a heavier border on the left and a darker surface, not by colour. Warm colours mean late in Slip and are never used for warnings.
  - The action is the suggested fix. One, or two when there is a real choice.

## Correct

```tsx
<Notice tone="attention" action={<Button variant="primary">Swap them</Button>}>
  Update A is the later one: its data date is 1 July 2026 and update B's is 1 June 2026.
</Notice>
```

## Incorrect

```tsx
<Notice tone="attention">Warning!</Notice> // says nothing, and has an exclamation mark
```
