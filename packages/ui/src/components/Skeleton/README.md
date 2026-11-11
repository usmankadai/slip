# Skeleton

## Contract

- **Use for** the loading state of a panel whose shape is known: rows of a table, a line of text.
- **Do not use for** a job with progress to report (use `ProgressBar`), or for anything that takes under about 300ms (show nothing).
- **Props:** `width`: `short`, `medium` or `long`.
- **Rules:**
  - Keep the shape of what is coming, so nothing jumps when it arrives.
  - It is hidden from assistive technology. The panel it is in must say in words what is being worked out, and carry `aria-busy`.
  - It does not animate. Motion is not used for data.

## Correct

```tsx
<section aria-busy="true">
  <h2>Finding the milestones that moved</h2>
  <Skeleton width="long" />
</section>
```

## Incorrect

```tsx
<Skeleton /> // alone, with nothing saying what is loading
```
