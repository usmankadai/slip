# D23: How the design-system rules are enforced

Date: 15 November 2026. Status: accepted.

## Context

The design-system spec lists automated checks: lint rules for raw colours, raw spacing, root row selectors, required states and date constructors; a screenshot test and an axe test for every story; and the bundle secrets check. They exist so that an agent writing UI is told when it has gone wrong, not trusted to remember.

## Decision

- **Lint rules for code.** `tools/eslint-plugin-slip` has `no-raw-color` and `no-raw-spacing`, on all TypeScript and TSX in `apps/web/src` and `packages/ui/src` except tests. `no-raw-spacing` looks at `style` props only; other objects may hold numbers.
- **Tests for CSS.** ESLint does not read CSS, and no CSS linter is installed. A repository test reads every CSS file except `tokens.css` and fails on colour literals and on pixel values for margin, padding or gap. This avoids a new dependency for two checks.
- **Required states are checked through stories, not rendered branches.** The spec says panels must render `Skeleton`, `EmptyState` and `ErrorState` branches. Slip's screens say their empty and error states in words, through `Notice` and their own layouts, not through shared empty and error components. What can be checked reliably is that every screen file has stories named for loading, empty and error and at least one more, which is also what the definition of done asks. A file that is a container rather than a view (it talks to the engine) is named without `View`, `Grid` or `Panel`.
- **axe on every story.** `tools/a11y` serves the built Storybook, runs axe-core against WCAG 2.0, 2.1 and 2.2 A and AA on every story, and fails on any serious or critical violation. It is part of `pnpm check` and its own CI job.
- **Two rules are covered another way.** `no-date-constructor` is covered by `no-restricted-globals`, which bans `Date` outright in the pure packages, a stronger rule. `no-root-row-selectors` does not apply: there is no Redux store.

## Consequences

- `pnpm check` takes longer: about a minute more for axe over 101 stories on the build machine.
- **Not built:** the screenshot test for every story in the Playwright Docker image. It needs Docker locally and in CI and baselines committed; it is the next check to add.
- The first axe run found two real faults, both fixed: buttons whose spoken name did not contain their visible words, and links under the 24px target size.
