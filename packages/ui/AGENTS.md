# Writing Slip's interface: guidance for coding agents

Read this before writing or changing any UI in `apps/web` or `packages/ui`. It is short on purpose. The rules here are checked by `pnpm check`; where a rule is only guidance, it says so.

## The rules that are checked

| Rule                                              | Checked by                                                                        | What fails                                                                                                                                                                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Colours come from tokens                          | `slip/no-raw-color` (lint) and `tools/eslint-plugin-slip/test/repository.test.ts` | A hex colour or a colour function (`rgb(`, `hsl(`, `oklch(` and the rest) anywhere outside `packages/ui/src/tokens.css`                                                                                                  |
| Spacing comes from tokens                         | `slip/no-raw-spacing` (lint) and the same repository test                         | A pixel value for margin, padding or gap, in a CSS file or a `style` prop. Use `var(--space-0)` to `var(--space-8)`                                                                                                      |
| Every screen has all four states                  | The repository test                                                               | A `*View.tsx`, `*Grid.tsx` or `*Panel.tsx` under `apps/web/src/features` without stories whose names start `Loading`, `Empty` and `Error`, plus at least one other                                                       |
| Nothing inaccessible ships                        | `pnpm a11y`: axe on every Storybook story                                         | Any serious or critical WCAG 2.2 AA violation                                                                                                                                                                            |
| Every component has a contract with both examples | `packages/ui/test/components.test.tsx`                                            | A component folder without a README that has Use for, Do not use for, a Correct and an Incorrect example, or missing from the table below. The Guidelines/Do and do not page in Storybook is drawn from the same READMEs |
| Contrast between tokens holds                     | `packages/ui/test/tokens.test.ts`                                                 | A token change that breaks a contrast rule in decision D16                                                                                                                                                               |
| Pure packages stay pure                           | `no-restricted-globals` and `no-restricted-imports`                               | `Date`, `window`, `document` or React in `packages/xer`, `packages/engine` or `packages/gen`                                                                                                                             |

Widths, heights and positions in pixels are allowed: they are layout, often computed from data. Borders of 1px or 2px are allowed.

## The rules that are not checked, and matter as much

- **Use what exists.** Look in `packages/ui/src/index.ts` before writing a new element. If something is missing, add it to `packages/ui` first, with a story, a contract at the top of its README and a test, then use it.
- **Never rely on colour alone.** Every slip value has a sign and a number. Pass and fail have a shape and a word. Warm means late and blue means early, everywhere; never use them for anything else, including warnings.
- **The accent is for selection, focus and the one main action.** Never in a data cell or a Gantt bar.
- **Numbers** are tabular, right aligned, and carry a unit: `+67d`, `7.0%`, `350,412 activities`.
- **Copy** is plain British English, sentence case, no em dashes, no exclamation marks, in planner vocabulary: data date, total float, driving path, update.
- **Text from a schedule or a model is text.** Never render it as HTML or Markdown.
- **Schedules stay in the engine worker.** Never put schedule arrays in React state or props; pass indices and ask the engine for the rows on screen.
- **Say what is hidden.** A filtered view always says how many rows it hides.

## Components

Each has a contract in its README. The one-line version:

| Component          | Use for                                                                                                                            | Not for                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `Button`           | An action. `primary` for the one main action on a screen, `quiet` for secondary ones                                               | Navigation; a choice among options                                    |
| `SegmentedControl` | Choosing one of two to eight options that are all visible: density, kind of change                                                 | An action; several on/off switches                                    |
| `Notice`           | A message that stays until the situation changes: a check, a warning, a question. `attention` is a heavier left edge, not a colour | Something that disappears on its own                                  |
| `ProgressBar`      | A job the planner waits on, with what is happening and its units                                                                   | A value in the data                                                   |
| `Skeleton`         | Holding the shape of a loading panel, inside a container that says in words what is loading                                        | Anything under 300ms; alone                                           |
| `DeltaCell`        | How far a date moved, in working days: number and bar on a fixed scale                                                             | Durations, float, counts                                              |
| `EntityChip`       | One piece of evidence beside a claim; opens what it names                                                                          | Data values; decoration                                               |
| `AgentSteps`       | The assistant's working, folded into one line                                                                                      | Progress of a file read                                               |
| `AgentText`        | The text of an assistant's answer, with checked citations                                                                          | Narrative text; the planner's words                                   |
| `ScriptedBadge`    | Every scripted answer                                                                                                              | Live answers                                                          |
| `ProposedEditCard` | A change the assistant proposed, before and after, for approval                                                                    | Changes made without asking                                           |
| `Dialog`           | Something opened to read or answer, then closed to go back: where your data goes                                                   | A message that should stay on screen; activity detail beside the grid |
| `TabBar`           | Switching what one panel shows, between parts about the same thing; the first tab holds the answer                                 | Filtering a list; moving between screens                              |
| `MentionInput`     | The assistant's question box: `#` lists activities and writes the chosen code into the text                                        | Searching a screen; picking from a fixed set                          |

## Density

The grid has two densities, switched by `data-density` on a container: compact (24px rows, 12px text) and comfortable (32px rows, 13px text, wider cell padding). Read `--row-height`, `--cell-padding-x`, `--grid-text` and `--grid-leading`; never hard-code them. Windowing code that needs the row height as a number uses `ROW_HEIGHT` from `@slip/ui`, which a test keeps equal to the token. Column widths, number formats, the slip bar's scale and colours never change with density.

## A correct example and an incorrect one

```tsx
// Correct: tokens, an existing component, a unit, words as well as colour.
<Notice tone="attention" action={<Button variant="primary" onClick={swap}>Swap them</Button>}>
  Update A is the later one: its data date is 1 July 2026 and update B&apos;s is 1 June 2026.
</Notice>
<DeltaCell days={row.slipDays} />
```

```tsx
// Incorrect: a raw colour (fails slip/no-raw-color), raw spacing (fails slip/no-raw-spacing),
// colour alone carrying the meaning, a number with no unit, and an exclamation mark.
<div style={{ padding: 12, color: '#b8321f' }}>Late! {row.slipDays}</div>
```

## Before you finish

- `pnpm check` passes: it runs the lint rules, the repository checks, the tests, both builds and axe on every story.
- A new screen or panel has stories for loading, empty, error and populated.
- `docs/journal.md` says what you built and what was decided by whom.
