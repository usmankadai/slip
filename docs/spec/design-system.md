# Design system (`packages/ui`)

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


## Tokens (CSS custom properties, defined once in `tokens.css`)
- Colour: `--surface-0..3`, `--text-primary/secondary/muted/inverse`, `--border-subtle/strong`, `--accent`, `--focus-ring`
- Semantic data colours: `--slip-late-1..5`, `--slip-early-1..5`, `--slip-none`, `--float-neg`, `--float-zero`, `--float-low`, `--float-high`, `--critical`, `--status-notstarted/active/complete`
- Space: `--space-0..8` on a 4px scale
- Type: `--font-sans`, `--font-mono`, sizes `--text-xs..xl`, line heights
- Density: `--row-height`, `--cell-padding-x`, switched by `[data-density="compact" | "comfortable"]`
- Radius, shadow, z-index, motion duration and easing

Built so far (`packages/ui/src/tokens.css`, values from [D16](../decisions/D16-visual-identity.md)): everything above except the float and status colours, which wait for the screens that use them. Also `--slip-late-text` and `--slip-early-text` (a slip value written as text on a surface), `--critical-hatch`, `--leading-*` line heights, and `--grid-text` and `--grid-leading`, which switch with density. `packages/ui/test/tokens.test.ts` enforces the contrast rules in D16 on the token file, so a changed value that breaks one fails `pnpm check`.

Light theme first. Dark theme tokens are a stretch goal but token names must not assume light (no `--white`, `--grey-100` in components). Fonts are self-hosted (no third-party font requests), which also keeps the CSP strict.

## Components
Each component ships with: implementation, `*.stories.tsx` covering every state, a contract block at the top of its README, and unit or visual tests.

- **Cells:** `TextCell`, `CodeCell`, `DateCell`, `DurationCell`, `FloatCell`, `DeltaCell`, `StatusCell`, `FlagsCell` (change bitmask as icons)
- **Gantt primitives (canvas painters, not React components):** activity bar, milestone diamond, summary bar, baseline ghost bar, critical bar, progress fill, relationship line, data date line, today line, focus ring
- **Chrome:** `PanelShell`, `Toolbar`, `SegmentedControl`, `TabBar`, `Drawer`, `CommandMenu`, `Tooltip`, `Popover`, `Menu`, `Button`, `IconButton`, `Badge`, `Kbd`
- **Data display:** `StatTile`, `DeltaBadge`, `HealthCheckRow`, `ContributorList`, `Timeline` (audit), `DataFlowDiagram`, `PerfHud`
- **Entity:** `EntityChip` (activity, WBS, code), `MentionInput`
- **Agent blocks:** `AgentStep`, `AgentStepsGroup` ("Worked for Xs, N steps"), `AgentText`, `AgentTable`, `AgentChart`, `ProposedEditCard`, `AgentError`, `ScriptedBadge` ("Scripted answer, not AI")
- **Feedback:** `Skeleton`, `ProgressBar` (with rows / bytes), `EmptyState`, `ErrorState`, `Toast`, `Notice` (persistent warning, for example non-retained-logic files)

Built so far: `Button`, `ProgressBar`, `Notice`, `DeltaCell` (the slip cell from exploration 01: a signed number of working days and a bar on a fixed scale) and `Skeleton`, each with stories, a contract in its README and a unit test. Screen stories live beside their feature in `apps/web` and are picked up by the same Storybook (`Screens/Import`, `Screens/Update summary`).

## `packages/ui/AGENTS.md` (written in phase 4)
Guidance aimed at coding agents. For each component: when to use it, when not to, required props, density limits, and a correct and an incorrect example. Plus global rules: use tokens only, use existing components before creating new ones, every new view needs all four states, every number uses a numeric cell.

## Automated checks (must run in CI and locally with `pnpm check`)
- `slip/no-raw-color`: no hex, rgb or hsl literals outside `tokens.css`
- `slip/no-raw-spacing`: no px values for margin, padding or gap outside tokens (1px borders allowed)
- `slip/no-root-row-selectors`: flags selectors that return whole row arrays
- `slip/require-states`: feature panels must render `Skeleton`, `EmptyState` and `ErrorState` branches
- `slip/no-date-constructor`: no `new Date(string)` or `Date.parse` in `packages/xer`, `packages/engine` or `packages/gen`
- Playwright screenshot test for every story (light theme, both densities). Baselines are created and compared inside the official Playwright Docker image, locally and in CI, so font rendering matches.
- axe accessibility test for every story and for the main app views; zero serious or critical violations
- Performance budgets ([performance budgets](performance.md))
- `pnpm check:secrets` on the built bundle

## Storybook
Run with `pnpm storybook`; built by `pnpm build:storybook`, which is part of `pnpm check`. Telemetry is off. So far it holds the foundation pages only (colour, slip scale, type, density, space and shape); every value shown is read from the tokens on the page. It is not deployed yet.

Deployed publicly with the app. As well as component stories it carries written pages (principles, identity, the slip colour scale, density, states, content, do and do not per component, canvas primitives). The list and the reasoning are in [design.md](design.md). The do and do not examples are the same ones used in `AGENTS.md`.

## Agent comparison experiment
`docs/agent-experiment/`: three UI tasks (for example "add a Constraint column", "build a panel listing new relationships", "add an empty state to the Health panel"). Run each with Claude Code **without** `AGENTS.md` and the lint rules, then **with** them. Commit both outputs, screenshots, and how many check failures each produced. This is a headline item in the case study.
