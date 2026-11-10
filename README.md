# Slip

A schedule update review workspace for large construction and infrastructure programmes. Load two updates of the same Primavera P6 schedule and see what changed, why key dates slipped, and whether the schedule can still be trusted.

Early in the build: the spec and the XER parser exist; no screens yet. See [docs/journal.md](docs/journal.md) for what is done and who did what.

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
