# D21: Storybook is deployed as its own project

Date: 11 November 2026. Status: accepted.

## Context

The spec wants the design system's Storybook public alongside the app. The app is served under a strict Content Security Policy: no inline scripts or styles, same-origin connections only. Storybook's own pages are expected to need inline scripts, which that policy blocks. This was not tested; it is what Storybook's generated pages are known to do.

## Options

1. **Same deployment, at `/storybook/`.** One project and one address. Needs looser headers for that path, which puts an exception into the policy the project is demonstrating.
2. **A second Vercel project, built from `packages/ui`.** Its own address. The app's headers stay untouched. Two projects to look after.

## Decision

Option 2. Chosen by Usman on 11 November 2026, on the agent's recommendation.

## Consequences

- `packages/ui/vercel.json` builds Storybook with `pnpm build-storybook` and serves `storybook-static`. The Vercel project's root directory is `packages/ui`. It sends three plain security headers and no Content Security Policy.
- The app links to it from its footer when `VITE_STORYBOOK_URL` is set on the app's Vercel project. The value is checked to be an https address before it is used.
- Storybook holds no user data and reads no schedule: its stories use made-up values.
- Screen stories are read from `apps/web`, so the Storybook project builds with files outside its root directory. That is Vercel's default for a workspace; if it is switched off the build fails.
