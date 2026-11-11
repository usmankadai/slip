# Slip

A schedule update review workspace for large construction and infrastructure programmes. Load two updates of the same Primavera P6 schedule and see what changed, why key dates slipped, and whether the schedule can still be trusted.

- **The app:** https://slip.usmankadai.dev
- **The design system (Storybook):** https://slip-design-system.usmankadai.dev

Part built. Two screens work: importing two updates, and the update summary. The changes grid, Gantt, slip trace, health view, narrative and assistant panel are not built yet. See [docs/journal.md](docs/journal.md) for what is done and who did what.

## Run it

Needs Node 24 and pnpm (`corepack enable` provides the version pinned in `package.json`).

```bash
pnpm install
pnpm check
pnpm dev
```

## Where things are

- [CLAUDE.md](CLAUDE.md): the rules and a map of the spec
- [docs/spec/](docs/spec/): the detailed spec
- [docs/decisions/](docs/decisions/README.md): decisions and their reasons
- `packages/xer`: the streaming XER parser and the columnar schedule format

## The assistant

The assistant is off by default. To run it live, copy `.env.example` to `.env`, set `AGENT_MODE=live`, `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`, and start the server:

```bash
pnpm --filter @slip/api dev
```

Set a spending limit on the API key in the Anthropic console. The server limits questions per visitor and model calls per day, but the limit on the key is the final backstop.
