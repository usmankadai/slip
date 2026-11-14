# ScriptedBadge

## Contract

- **Use for** every answer the scripted assistant gives, so nobody mistakes canned prose for a model's.
- **Do not use for** a live answer, or as decoration elsewhere.
- **Props:** none. The wording is fixed: "Scripted answer, not AI".
- **Rules:** shown beside the answer it labels, not once for the whole panel, so a screenshot of one answer still carries it.

## Correct

```tsx
{
  answer.scripted ? <ScriptedBadge /> : null;
}
```
