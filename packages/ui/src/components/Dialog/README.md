# Dialog

## Contract

- **Use for** something the planner opens to read or answer, then closes to go back to the same place: where your data goes, a confirmation that needs more than one line.
- **Do not use for** a message that should stay on screen (`Notice`), the detail of one activity beside the grid (a drawer, when it exists), or anything the planner must see without asking.
- **Props:** `open` and `onClose` (the caller owns whether it is open), `title`, `children`.
- **Rules:**
  - Built on the native `dialog` element opened with `showModal`, so focus stays inside and goes back to what opened it. Escape, the Close button and a click on the backdrop all close it.
  - The title names what it is about, in sentence case. It is the dialog's accessible name.
  - One dialog at a time. Never open one from inside another.

## Correct

```tsx
<Dialog open={open} onClose={() => setOpen(false)} title="Where your data goes">
  <WhereDataGoes mode="scripted" />
</Dialog>
```

## Incorrect

```tsx
<Dialog open title="Warning!">
  Something went wrong
</Dialog> // no way to close it, and a warning belongs in a Notice
```
