# Deployment, CI and monitoring

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


## Environments
- **Local:** `pnpm dev` runs the web app and API together. Scripted mode needs no configuration at all.
- **Preview:** every pull request gets a Vercel preview deploy in scripted mode.
- **Production:** `main` deploys automatically after CI passes. Live mode is switched on by environment variables only.
- All configuration is by environment variable, documented in `.env.example`. Missing optional variables (key, Redis, Sentry) switch the feature off cleanly; they never crash start-up.
- `GET /health` on the API returns the build commit and which optional features are configured (booleans only, no values).
- The footer of the app shows the build commit and links to the repository, `docs/perf.md` and the case study.

## CI (GitHub Actions; adapt switchboard's workflow)
Every job runs without secrets. A newer push cancels the older run. Jobs:
1. **Checks:** install with a frozen lockfile, lint (including custom rules), typecheck, unit tests, `evals:replay`, `pnpm audit`.
2. **Build:** production build, bundle-size budget, `check:secrets`.
3. **E2E and accessibility:** Playwright against the production build under the real security headers, with axe. Chromium for the full suite; Firefox and WebKit for the smoke test. Traces uploaded on failure.
4. **Visual:** story screenshots in the Playwright Docker image.
5. **Performance:** the CI subset from [performance budgets](performance.md).

`pnpm check` runs the same things locally. Branch protection on `main` requires all jobs.

## Monitoring
- **Sentry** only when `VITE_SENTRY_DSN` is set, loaded by dynamic import after first paint. All default data collection (request bodies, headers, cookies, query strings) is off. A scrubber (port switchboard's) runs on every event and breadcrumb and removes query strings and anything that could be schedule content; error messages in `packages/xer` and `packages/engine` are written to contain indices and counts, never names. Worker errors are forwarded to the main thread and reported with the worker's name.
- **Server logs:** one JSON line per request: route, status, duration, model call count, input, output and cache-read token counts, rate-limit outcome. No content.
- **Real-user performance:** import, CPM and diff timings and the activity count bucket (100K, 350K, 1M) are recorded locally and shown in the HUD. They are sent nowhere unless Sentry is on, and then only as numbers.

## Release
- Semantic version in the root `package.json`, a `CHANGELOG.md` updated per phase, and a git tag when a phase's definition of done passes.
- `README.md` covers: what Slip is, a 60-second tour with screenshots, how to run it, the published numbers, the data flow statement, known limits (calendars, retained logic only, no XER export), and the designed-versus-generated split with a link to the journal.
- `LICENSE` file. `fixtures/real/SOURCE.md` records where each real file came from and its licence; never commit a schedule from a real client or employer.
