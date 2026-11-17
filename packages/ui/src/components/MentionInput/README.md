# MentionInput

## Contract

- **Use for** a question box where the planner names activities: the assistant's input. Typing `#` opens a list of activities; choosing one writes `#CODE` into the text (exploration 12, option A).
- **Do not use for** searching or filtering a screen (the grid's search box), or picking one value from a fixed set (`SegmentedControl`).
- **Props:** `id`, `value`, `onChange`, `onSubmit`, `onMentionQuery`, `list`, and `placeholder`, `maxLength`, `rows`, `disabled` passed to the textarea.
- **Rules:**
  - It only draws. The caller searches when `onMentionQuery` gives it the text after `#`, and passes the result as `list`: `loading`, `error` with a message, or `ready` with the options shown and the total that matched. `null` shows no list.
  - Show at most 8 options, sorted so the most likely come first. When there are more than shown, the caption says how many matched and how they were chosen.
  - The text is exactly what is sent. A choice writes the activity code as in P6, never its name.
  - The list is reached from the keyboard without leaving the box: arrows move, Enter or Tab chooses, Escape closes the list but not what holds the box. Enter with no list open calls `onSubmit`; Shift+Enter is a new line.
  - Slip is shown as a signed number of working days with a unit, and in the slip colours. The sign carries the direction, not colour alone.
  - The caller gives the box a visible or visually hidden `<label htmlFor={id}>`.
  - Names come from the schedule and are rendered as text, never as HTML.

## Correct

```tsx
<label htmlFor="agent-question">Your question</label>
<MentionInput
  id="agent-question"
  value={draft}
  onChange={setDraft}
  onSubmit={ask}
  onMentionQuery={setQuery}
  list={query === null ? null : results}
/>
```

## Incorrect

```tsx
<MentionInput id="q" list={{ state: 'ready', options: everyActivity, total: n }} … />
// never hand it the whole schedule: search in the engine and pass the few rows shown
```
