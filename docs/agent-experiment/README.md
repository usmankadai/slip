# Agent comparison experiment

Does Slip's design system for agents change what a coding agent builds? Three UI tasks, each given to Claude Code twice: once **without** `packages/ui/AGENTS.md` and the automated checks, once **with** them. Every output was then scored by the same checks.

Run on 15 November 2026. The spec for it is in [design-system.md](../spec/design-system.md#agent-comparison-experiment).

## Result in one paragraph

Neither condition wrote a raw colour or raw spacing, missed a state story, broke a type, failed a test of its own or left a formatting fault. All six outputs worked and looked right. The one measurable difference: the run without the checks put its new stories on top of an existing accessibility fault (summary links below the 24px target size) and shipped two more failing stories without knowing, because nothing told it. The runs with the checks could not have done that. The rules mostly confirmed habits the agent already had from `CLAUDE.md` and the existing code; their value here was catching what was already wrong, not stopping new mistakes. Three tasks with one run each is too small to say more.

## Setup

|                           | Without (A)                                                                                    | With (B)                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Starting commit           | `7bdbbf3`, main before the design-system checks                                                 | `55b88d0`, main with the checks (PR 41)                                                                         |
| `packages/ui/AGENTS.md`   | Absent                                                                                         | Present                                                                                                         |
| Lint rules and repo test  | Absent                                                                                         | `slip/no-raw-color`, `slip/no-raw-spacing`, the CSS and screen-state test                                       |
| axe in `pnpm check`       | Absent                                                                                         | On every story                                                                                                  |
| Same in both              | `CLAUDE.md` (which already says: tokens only, four states, no colour alone), the code, the model (Claude Opus 5.5), the prompt, a fresh git worktree, no browser pane | |

Each run was a separate agent with no memory of the others, told not to look at any other `experiment/` branch. The prompt was identical apart from the branch name:

> Work the way you normally would in this repository. When you are done, commit your work on that branch. Do not push, do not open a pull request, do not merge, and do not look at any other branch whose name starts with experiment/.

## Tasks

1. **Constraint column.** In the changes grid, add a column showing each activity's constraint in update B, the type in words and its date, blank when there is none.
2. **Added activities box.** On the update summary, add a rail box listing activities new in update B: code, name and finish for at most 10, the total, and each leading to that activity in the changes grid.
3. **Status badge.** Show each activity's status in update B as a small badge in a new grid column, using a reusable component.

## Scoring

[`score.sh`](score.sh) checks out each result and puts **every** check in place from the "with" commit, so both conditions are judged by the same rules: lint (by rule), the CSS and screen-state test, typecheck, all unit tests, Prettier, the Storybook build and axe on every story. [`summarise.py`](summarise.py) counts the results.

The "without" commit already fails some checks before any agent touches it: two screens with no stories, which fail the repository test, and 11 axe faults across the health and summary stories (fixed in PR 41). Only failures beyond each run's own starting point count.

## Results

| Run           | Raw colour or spacing | Missing states | Type errors | Tests failed | Format | Stories checked | axe serious, new | Files changed | Lines added |
| ------------- | --------------------: | -------------: | ----------: | -----------: | -----: | --------------: | ---------------: | ------------: | ----------: |
| Start A       |                     0 |              2 |           0 |            1 |      0 |              96 |               11 |               |             |
| Start B       |                     0 |              0 |           0 |            0 |      0 |             101 |                0 |               |             |
| Task 1, A     |                     0 |          0 new |           0 |        0 new |      0 |              96 |                0 |             9 |         122 |
| Task 1, B     |                     0 |              0 |           0 |            0 |      0 |             101 |                0 |             9 |         116 |
| Task 2, A     |                     0 |          0 new |           0 |        0 new |      0 |              98 |            **2** |            11 |         350 |
| Task 2, B     |                     0 |              0 |           0 |            0 |      0 |             103 |                0 |            12 |         227 |
| Task 3, A     |                     0 |          0 new |           0 |        0 new |      0 |             100 |                0 |            14 |         206 |
| Task 3, B     |                     0 |              0 |           0 |            0 |      0 |             105 |                0 |            15 |         235 |

The two new axe faults in Task 2, A are the stories it added ("Added few", "Added none"). The fault is the existing "What changed" links, not the agent's new box, but the run shipped them without knowing; its own `pnpm check` had no axe.

## What differed, read by hand

- **Task 1.** Almost the same change twice: a shared function in `shared/format.ts` that both runs also used to remove duplicated words from the assistant's edit card, and one new column. A made the column sortable by date; B did not. Widths differ by 8px.
- **Task 2.** A used short dates ("8 Jul 2026"), a "See all 412 added activities" button and a test against the real engine. B used long dates to match the milestone table, put the code under the name, and added a note to the summary flow. Both found the activity by its index, not by searching for its code, and both flagged that the design spec does not list this box and no flow was drawn for it.
- **Task 3.** Both made a neutral `StatusCell` in `packages/ui` with a story, README contract and tests, using an empty, half and full circle so status never depends on colour. A writes "Not known" when the file gives no status; B leaves the cell empty. Only B added the component to the components table in `AGENTS.md`, the one place where reading the rules changed what was built.
- **Checking.** Every run said what it had not checked. None of them could open the browser pane. Three (Task 2 in both conditions and Task 3, B) checked their work in a headless browser instead; the other three relied on tests and stories.

## Limits

- One run per task per condition, one model. A difference this small could be chance.
- `CLAUDE.md` carries the main rules in both conditions, so "without" means without the detailed guide and the checks, not without guidance.
- The "without" commit is older than main, and one A run noticed that `AGENTS.md` exists in a later commit. It did not read it.
- The tasks are small and sit inside screens with strong patterns to copy. A new screen with nothing to copy would test the rules harder.
- The agents knew the work was a portfolio project but were not told they were being compared.

## Files

`runs/<task>-<condition>/` holds each run's full change as `changes.patch`, its `diffstat.txt` and a screenshot of the main story. The branches `experiment/t1-a` to `experiment/t3-b` are kept locally, not pushed.
