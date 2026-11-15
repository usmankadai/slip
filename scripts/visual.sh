#!/usr/bin/env bash
# Runs the screenshot suite inside the official Playwright image, as CI does, so baselines made
# here match CI's. The repository is copied into the container so its Linux node_modules never
# touch the ones on this machine. Pass --update to rewrite the baselines.
set -euo pipefail
IMAGE=mcr.microsoft.com/playwright:v1.65.0-noble
UPDATE=""
if [[ "${1:-}" == "--update" ]]; then UPDATE="--update-snapshots=all"; fi
docker run --rm --ipc=host -v "$PWD":/repo -w /repo "$IMAGE" bash -euo pipefail -c "
  mkdir -p /work
  tar -C /repo --exclude=node_modules --exclude=storybook-static --exclude=dist -cf - . | tar -C /work -xf -
  cd /work
  corepack enable >/dev/null
  pnpm install --frozen-lockfile >/dev/null
  pnpm build:storybook >/dev/null
  status=0
  pnpm --filter @slip/visual exec playwright test $UPDATE || status=\$?
  rm -rf /repo/tools/visual/baselines && cp -r tools/visual/baselines /repo/tools/visual/baselines
  rm -rf /repo/tools/visual/test-results && cp -r tools/visual/test-results /repo/tools/visual/ 2>/dev/null || true
  exit \$status
"
