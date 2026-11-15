#!/bin/bash
# Scores one experiment branch with every check, whichever condition produced it.
# Usage: score.sh <branch> <out-dir>
set -u
REPO=/Users/usmandev/Desktop/GitHub/slip
BRANCH=$1
OUT=$2
WT=$OUT/tree
mkdir -p $OUT
rm -rf $WT
git -C $REPO worktree add --detach $WT $BRANCH > /dev/null 2>&1 || { echo "worktree failed"; exit 1; }
cd $WT
BASE=$(git -C $REPO merge-base $BRANCH experiment/base-b)
# The changes the agent made, against its own starting point.
START=$( [[ $BRANCH == *-a ]] && echo experiment/base-a || echo experiment/base-b )
git -C $REPO diff --stat $START $BRANCH > $OUT/diffstat.txt
git -C $REPO diff $START $BRANCH > $OUT/changes.patch
git -C $REPO log --format='%h %s' $START..$BRANCH > $OUT/commits.txt
# Put every check in place, from the "with" starting point.
for path in tools/eslint-plugin-slip tools/a11y eslint.config.js; do
  rm -rf $path
  git -C $REPO archive experiment/base-b $path | tar -x -C $WT
done
pnpm install --no-frozen-lockfile > $OUT/install.log 2>&1
# 1. Lint, by rule.
pnpm exec eslint apps/web/src packages/ui/src -f json -o $OUT/eslint.json > /dev/null 2>&1
# 2. CSS and screen-state checks.
pnpm exec vitest run tools/eslint-plugin-slip/test/repository.test.ts > $OUT/repository.log 2>&1; echo $? > $OUT/repository.exit
# 3. Types, 4. tests, 5. format.
pnpm -r typecheck > $OUT/typecheck.log 2>&1; echo $? > $OUT/typecheck.exit
pnpm exec vitest run > $OUT/test.log 2>&1; echo $? > $OUT/test.exit
pnpm exec prettier --check . > $OUT/format.log 2>&1; echo $? > $OUT/format.exit
# 6. Storybook and axe on every story.
pnpm --filter @slip/ui build-storybook > $OUT/storybook.log 2>&1; echo $? > $OUT/storybook.exit
node tools/a11y/src/run.ts > $OUT/a11y.log 2>&1; echo $? > $OUT/a11y.exit
echo done
