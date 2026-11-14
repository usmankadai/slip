# Build journal

What was built, what Usman decided or designed, and what an agent generated. Newest first.

## 12 November 2026: the health screen

**Done**

- The fifth product screen. A sentence answers the question ("5 checks got worse, 1 got better"), then the checks that moved, grouped as worse and better, then the rest in DCMA order. Each check shows what it counts, the rule it is judged by, its figure in each update, and the change.
- "See them" on a check opens the changes grid on the activities counted against it in update B. Back returns to health.
- Reached from the summary's health box. The summary's sentence and this screen use one rule, so they cannot disagree.
- States: loading, error, and nothing changed, where the lead says so and all 14 follow.

**Usman decided or designed**

- Layout A ("A, changed first"), on the agent's recommendation. No reasons of his own.

**The agent (Claude) generated**

- All the code, tests, stories and copy, including a one-line description of what each of the 14 checks counts.
- The rule for worse and better, which was open. First built on the count of activities; changed after seeing it in the browser, where "Missing logic" read as better with a larger share failing. A failing check is now judged on the figure its threshold applies to. This changed the summary's sentence too: on the 10,000 activity sample it went from "3 worse, 3 better" to "5 worse, 1 better".
- Pass and fail marks: a filled square, an empty square, and a dotted circle for a check with no judgement. No colour.

**Worth Usman's attention**

- The worse-or-better rule is a judgement about planning. A check that passes in both updates is never called worse, however much its figure moved towards the threshold.
- Three checks are not the full DCMA test: resources (not assessed), the critical path test (reported only) and the critical path length index (uses the lowest float in the schedule). The first two say so on the screen through the engine's notes; the third does not.
- "See them" shows update B only. There is no way to see which activities were counted in update A, or which are newly counted.
- The states of this screen were not drawn first; they exist as stories.

## 12 November 2026: layouts for the health screen

**Done**

- Three low-fidelity layouts for the health comparison, using the engine's real check names and thresholds with made-up figures.

**Usman decided or designed**

- To draw these next. Nothing on the page yet.

**The agent (Claude) generated**

- The page, the three layouts and the recommendation (A, what changed first).

**Worth Usman's attention**

- One choice is waiting. The health screen is not built until it is made.
- What "worse" means is open for a check that fails in both updates, and for the two index checks, which are ratios with no count of activities.
- Three of the 14 checks are not full DCMA tests today: resources cannot be assessed, and the critical path test and the critical path length index depart from the DCMA method. The engine's notes say how. The screen will have to say so plainly.

## 12 November 2026: the slip trace screen

**Done**

- The fourth product screen. For an activity that moved: the causes, largest first, each with what happened, the working days it added of its own, and its share; then the driving path beneath, opened on request, with what each activity inherited in grey and what it added in colour.
- Reached from each milestone row on the summary ("Trace") and from the selected row in the grid ("Trace selected", or the `t` key).
- States: loading, error, an activity that did not move, an activity new in update B, a trace that reached its size limit, and causes that do not add up to the slip (the difference is stated).
- Going back from a trace returns to the same rows, selection and scroll position in the grid.
- The engine's trace result now carries each activity's finish slip in working days.
- Checked against the 1,000 activity fixture: project completion shows +67 working days from four causes of 20, 18, 16 and 13 days on the activity codes in `expected.json`.

**Usman decided or designed**

- A leading with B beneath ("A with B beneath"), on the agent's recommendation. No reasons of his own.

**The agent (Claude) generated**

- All the code, tests, stories and copy.
- Rules that were open in the exploration, settled without asking: share is each cause's part of the slip added, and a recovery has none; the five largest causes are always listed, and smaller ones under 3 working days fold into one line; the path is listed furthest back first; inherited slip is the activity's own finish slip less what it added.
- Words for all six kinds of cause, and their opposites when time was recovered.
- Where the screen sits: a full screen with a way back, since no layout for it was drawn.

**Worth Usman's attention**

- The focused network view of the driving path is not built; the path is a list. The spec allows that to be cut, but it has not been cut by decision.
- The driving path can branch. The list flattens it by distance from the milestone, so two activities side by side in the network appear one after the other. The inherited figure is still each activity's own.
- Only the straight-path case has been seen in the browser. A branching path, a recovery and a truncated trace are covered by unit tests and stories with made-up data, not by a real schedule.
- No trace is possible for a removed activity, and nothing says so.

## 12 November 2026: options for the trace view

**Done**

- Exploration 03, the trace view: three treatments of the same trace, with a switch between the real case from the 1,000 activity fixture (four causes, +67 days) and a made-up one with a recovery and several small contributors.

**Usman decided or designed**

- To draw these next. Nothing on the page yet.

**The agent (Claude) generated**

- The page, the options, the write-up and the recommendation (ranked causes leading, the driving path beneath as evidence).
- In the real case only the four causes and their figures are real. The other activities on the path and every name are made up, and the page says so.
- Words for the kinds of cause ("Duration grew", "Taking longer", "Logic changed", "Recovered time"). The engine has six kinds; four were drawn.

**Worth Usman's attention**

- One choice is waiting. The trace screen is not built until it is made.
- What "share" means when an activity recovered time is unresolved. The mock shows share of slip added and gives the recovery none.
- No low-fidelity layout exists for the trace screen as a whole; this exploration covers the main panel only.

## 12 November 2026: the Gantt

**Done**

- A canvas Gantt beside the changes grid, on the same rows. Each activity has its bar for this update, and only the difference from the previous one: a tail from where the finish was, warm for later and blue for earlier, with a tick at the previous finish and at the previous start when it moved. The previous bar is drawn in full for the selected activity.
- Critical bars are hatched, progress is filled, milestones are diamonds, the data date is a dashed line. A bar or a previous finish that is out of view is shown as an arrow at that edge.
- The Gantt has no vertical scroll of its own: it paints exactly the rows the grid shows, so the two cannot drift apart. Selection and arrow keys are shared.
- Three time scales; drag or scroll sideways to move through time; the axis fits itself to the rows on screen when a view first loads, and moves to show a selected activity's bar.
- The positions of every mark come from a pure function with 23 tests; the painter only draws them.

**Usman decided or designed**

- Option C for the ghost bars ("C, your pick"), on the agent's recommendation. No reasons of his own.

**The agent (Claude) generated**

- All the code, tests and copy.
- Found while building, and decided without asking: with the axis at the data date, the worst movers finish years later and every bar was off the right edge, so the axis now fits itself to the rows on screen. That behaviour, and moving the axis when a row is selected, were not in the exploration.
- Other choices not drawn: the three scales and their pixel widths, the split between grid and chart (11 to 9), the "Grid only" switch, the bar's height, and the wording of the chart's description.

**Worth Usman's attention**

- Not built: relationship lines, tooltips, the drawer, and visual regression tests for the canvas. The table in `docs/spec/ui.md` says what each canvas rule's state is.
- A new activity still has no mark of its own on the chart.
- After scrolling a long way down, the bars can be off the edge again, shown as arrows, until "Fit to rows" is pressed. Whether the axis should follow the rows by itself is a design question; it does not, because a time axis that moves while you scroll is hard to read.
- The grid now has about half the width, so it scrolls sideways sooner. That is the accepted cost of layout A.
- Checked by hand in the browser at 10,000 and 350,000 activities. No automated test looks at what the canvas draws.

## 11 November 2026: options for the Gantt's ghost bars

**Done**

- Exploration 02, two schedules on one Gantt: three treatments over the same ten rows, covering a large slip, a one-day slip, an earlier finish, no change, a grown duration, a previous position off screen, a new activity, a milestone, a critical activity and one in progress. Switches for zoom and for colour-blind and greyscale views.

**Usman decided or designed**

- To draw these next. Nothing on the page yet.

**The agent (Claude) generated**

- The page, the three options, the write-up and the recommendation (C, only the difference, with the previous bar drawn in full for the selected activity).
- A placeholder that is really an identity decision: the colour of an ordinary activity bar, drawn as a dark neutral.

**Worth Usman's attention**

- One choice is waiting. The Gantt is not built until it is made.
- The recommendation is the least conventional of the three. No planner has seen it.
- No option marks a new activity. That needs deciding with whichever is chosen.

## 11 November 2026: the changes grid

**Done**

- The third product screen, first step: the changes grid at full width. Activities with any change, largest finish slip first. Columns: row number, code, name, finish in each update, finish slip as number and bar, total float, and what changed in words.
- Filter by kind of change or show every activity; find by code or name; sort by any column; compact and comfortable density; arrow keys, Page Up and Down, Home and End move the selection.
- The planner's place is kept: after a new filter or sort the selected activity is found again and brought back into view, or a line says it is now hidden.
- Scale honesty as decided: a status line with the rows on screen, the rows in the view and the number hidden, and a readout of the row while scrolling. Removed activities are counted in the status line, since they cannot be rows.
- Windowed, with the scrolling element capped in height so a million rows fit in one scroller. The engine gained `locate`. `SegmentedControl` was added to `packages/ui`.
- The summary now leads here: a "See all changes" button, and each line of "What changed" opens the grid on that kind.
- Tried by hand on the 350,000 activity rail pair: see `docs/spec/performance.md`.

**Usman decided or designed**

- Layout A, density B, and scale honesty A with the scrolling readout, by accepting the agent's three recommendations ("use your picks"). No reasons of his own.

**The agent (Claude) generated**

- All the code, stories, tests and copy.
- Choices made while building that were not drawn or asked about: which columns are shown and their widths; the default sort (largest finish slip first); the search box; that sorting a number column starts largest first; the selected row's look (a darker surface and an accent edge); the wording of every label and message; the 8,000,000 pixel cap.
- A change to the decided option: the scrolling readout shows for wheel and keyboard scrolling too, not only while the thumb is dragged.

**Worth Usman's attention**

- Not built: the Gantt (needs exploration 02), the drawer for the selected activity, configurable columns, URL state, the performance overlay, and a navigation bar. Enter on a row does nothing yet.
- The states of this screen were not drawn as a low-fidelity page before building; they exist only as stories.
- Above the height cap, one notch of the mouse wheel moves more than one notch of rows: about 3 times as far at a million rows. Keyboard movement is exact. This is a known cost of the approach.
- The scroll figures are from one hand-run check in a development build, not from the perf suite. The browser height limits quoted in exploration 07 are still unconfirmed; the cap was set well below both remembered figures.
- No screenshot or axe tests on stories, and no lint rules for raw colours and spacing, still.

## 11 November 2026: live check, and design options for the changes grid

**Done**

- Both live sites were checked: on https://slip.usmankadai.dev a sample pair imports and compares, the saved-copy cache is written, fonts load, the security headers are served and the console is clean; https://slip-design-system.usmankadai.dev loads with every story.
- The footer now links to the design system without any Vercel setting, and the README gives both addresses and says what is built.
- Three pages of options for the changes grid: three layouts for the screen, exploration 06 (density) and exploration 07 (scale honesty), each with a write-up.

**Usman decided or designed**

- Set up the two domains and deployed Storybook. Asked for the grid next.
- Nothing on the three pages yet.

**The agent (Claude) generated**

- The three pages, every option, the write-ups and the recommendations (layout A, density B, scale honesty A with a scrolling readout).
- The decision to make the Storybook address a default in the code, with the environment variable as an override.

**Worth Usman's attention**

- Three choices are waiting. The grid is not built until they are made.
- The browser limits quoted in exploration 07 (the tallest element a browser will lay out) are from memory and must be confirmed before the grid's scrolling is designed around them.
- Density B is what the identity already says, so that exploration is a check on an earlier decision, not a fresh one.

## 11 November 2026: the update summary screen

**Done**

- The second product screen. Milestones that moved lead, each with its finish in both updates and the slip as a number and a bar; a rail carries the critical path, the change counts and the health comparison. Each part loads and fails on its own.
- States built: loading, three kinds of empty, error, many milestones, and lines carried over from import when a file is incomplete or has warnings that may change dates.
- `DeltaCell` (the slip cell chosen in exploration 01) and `Skeleton` in `packages/ui`, with stories, contracts and tests. Nine stories for the screen.
- The engine's recalculation request has a preview mode that keeps nothing, so the summary can say how many activities Slip calculates differently while still showing the file's dates.
- Checked against the 1,000 activity fixture: the project completion milestone shows +67 working days, which is the figure in `expected.json`.

**Usman decided or designed**

- Asked for the agent's best suggestion on the open questions and answered "go": every milestone counts, the 20 largest moves are shown, the file's dates are used, and a line says so when Slip's own calculation differs.

**The agent (Claude) generated**

- The suggestion and its reasons, all the code, the stories and the copy.
- Not drawn first, and chosen while building: the header (project name, the two data dates, a way back to import); the rule for when a health check counts as worse (it starts failing, or fails by more); the bar uses scale step 4 below 40 working days and step 5 from 40; the slip cell is 72px of bar and 64px of number.

**Worth Usman's attention**

- Nothing on this screen leads anywhere yet: no trace, no changes view, no health screen. Those rows and lines are plain text until the screens exist.
- A milestone that was added, removed or completed this month does not appear.
- Not checked with a 350,000 activity pair, so the "top 20 may all be internal milestones" risk is untested.
- Working out of phase order: this is a phase 3 screen, built before the grid and Gantt of phase 2.

## 11 November 2026: first deploy, Storybook project and footer

**Done**

- The app is deployed to Vercel from `main`. Usman created the project; the repository's `vercel.json` supplied the build and the security headers.
- A second Vercel configuration in `packages/ui` builds Storybook as its own project (D21).
- The app has a footer: links to the source, the performance numbers and the journal, a link to the design system when its address is set, and the commit the build was made from.

**Usman decided or designed**

- To deploy Storybook as a second project and not inside the app's deployment, on the agent's recommendation.
- He created the Vercel project himself and deployed it.

**The agent (Claude) generated**

- The Storybook deploy configuration, the footer and its tests, and D21.
- The footer's look and wording, which were not drawn or asked about: one quiet line at the bottom, small muted text, "Source code", "Design system", "Performance numbers", "Build journal".

**Worth Usman's attention**

- The deployed app has not been checked by the agent. Only a screenshot of Vercel's thumbnail was seen. Workers, the saved-copy cache and fonts under the production headers on Vercel are unverified.
- The Storybook project does not exist yet; it needs creating in Vercel with root directory `packages/ui`, and its address setting as `VITE_STORYBOOK_URL` on the app's project.
- The claim that Storybook needs inline scripts was not tested. It is the reason given for D21.
- The first deploy came after the import screen, not at the end of week 1 as the plan asked.

## 11 November 2026: update summary states

**Done**

- The states of the chosen summary layout are drawn as boxes and labels: an ordinary month, loading (each box on its own), three kinds of empty (no milestone moved, nothing changed at all, no milestones in the schedule), error, hundreds of milestones, warnings carried over from import, and a narrow window.

**Usman decided or designed**

- To draw these next. Nothing on the page yet.

**The agent (Claude) generated**

- The page, the proposed copy and the list of open questions.
- Defaults drawn without an answer: every milestone counts, the 20 largest moves are shown, late moves are listed before early ones, and the file's own dates are used.

**Worth Usman's attention**

- Two questions change what the screen computes and need an answer before it is built: which milestones lead, and whether the summary uses the file's dates or Slip's recalculated ones.
- The navigation bar appears for the first time on this screen and has not been designed.

## 11 November 2026: the import screen

**Done**

- The first product screen. Two slots side by side; each reads a file in the parse worker, shows its project, data date and counts, and its import report grouped by what the warnings mean for the answer. Both schedules go to the engine worker, which says how many activities the two share; the line under the slots says whether the pair is sound.
- Handled: a file that is not an XER, an empty or oversized file, a truncated file (asks before it is used), several projects in one file (a picker), a pair in the wrong order (offers to swap), different schedules, the same file twice, and two files dropped together (ordered by data date).
- Three components in `packages/ui` with stories, contracts and tests: `Button`, `ProgressBar`, `Notice`. Nine stories for the screen's states.
- The parse worker takes a project id. The developer harness moved to `/?dev`; the perf suite still uses `/?perf`.
- CI: the perf job had been failing while fetching font packages from the Ubuntu mirrors, before measuring anything. It now installs only the browser. No budget changed.

**Usman decided or designed**

- Import layout A (earlier), and option B for the import report: "i will choose B". No reasons given for either.

**The agent (Claude) generated**

- All the code, the stories and every word of copy on the screen.
- The placement of the parser's 17 warning kinds into three groups. The mock had six.
- Built as drawn without an answer from Usman: the wording for two updates with the same data date, and disabling Compare updates when the same file is loaded twice.
- Choices made while building that were not drawn: the screen title "Import two updates"; the sample pair is 10,000 rail activities with no choice of size; progress shows the file name only, not the project name, until the file is read; "attention" notices are marked by a heavier left border and a darker surface, since there is no warning colour.

**Worth Usman's attention**

- Compare updates leads to a placeholder. The update summary is the next screen.
- Not done, and listed in `docs/spec/import-robustness.md`: the retained logic notice, export of the report, the audit log entry, malformed fixtures and the fuzz test. The awkward cases were checked by hand in the browser with files made from the 1,000 activity fixture, not by automated tests.
- No screenshot or axe tests on the stories yet, and the lint rules for raw colours and spacing still do not exist.
- The screen was not checked with a 350,000 activity pair in this step, and not on a narrow window beyond the slots stacking.

## 11 November 2026: import states and import warnings options

**Done**

- The states of the chosen import layout are drawn as boxes and labels: empty, loading, error, populated, populated with warnings, a file that needs an answer first (several projects, or a file that stops early), and the five wordings of the "do these two belong together" line.
- Exploration 08, import warnings: three options at the real width of a slot, with a switch between 3,012 warnings, 12 and none.

**Usman decided or designed**

- To draw these next. Nothing on the pages yet.

**The agent (Claude) generated**

- Both pages, all proposed copy, the three options and the recommendation (B, grouped by what it means for the answer).
- The grouping of the six kinds of warning into "may change dates", "changes what is compared" and "repaired while reading". This is a judgement about planning, made without a planner.
- Two things that go beyond the spec and are flagged on the page: a wording for two updates with the same data date, and disabling Compare updates when the same file is loaded twice.

**Worth Usman's attention**

- One choice (exploration 08) and three smaller questions are listed in `docs/design/flows/README.md`. The import screen is not built until they are answered.
- There is no warning colour. Warm means late, so the report is drawn without colour and uses a square mark. Whether Slip needs a warning colour at all is an identity question.
- The copy is a first draft throughout, and it is the part of this screen a planner will judge most.

## 11 November 2026: tokens and Storybook

**Done**

- `packages/ui` exists. `tokens.css` holds the D16 colour values and the space, type, density, shape, elevation and motion tokens. Inter and JetBrains Mono are self-hosted from npm packages.
- A test reads the token file and enforces the contrast rules in D16: primary text at 7:1, muted text only where it passes, bars and glyphs only from scale steps 4 and 5, inverse text on step 5.
- Storybook runs with five foundation pages: colour, slip scale, type, density, space and shape. Every value shown is read from the tokens. Building Storybook is now part of `pnpm check`.

**Usman decided or designed**

- The colour values, type scale, radii and densities, through D16 and the choices recorded below. Nothing new in this step.

**The agent (Claude) generated**

- The package, the test, the stories and their wording.
- Token values the spec did not give, chosen without asking: line heights (16, 16, 20, 20, 24, 28px), font weights (400, 500, 600), cell padding (8px compact, 12px comfortable), the one floating shadow, the z-index order, the easing curve, and the 2px focus ring in the accent colour. These are small, but they are design values and are Usman's to change.

**Worth Usman's attention**

- Float and status colours are not in the tokens. They are data colours and nothing has been drawn for them; they need the same treatment as the slip scale before the grid is built.
- Storybook is not deployed. No components yet, so no screenshot or axe tests on stories yet either; the spec asks for both once components exist.
- The custom lint rules (`no-raw-color`, `no-raw-spacing`) do not exist yet, so "no raw values outside tokens.css" is held by care, not by a check.

## 11 November 2026: the four design choices, made by accepting the recommendations

**Done**

- The four open choices are recorded: neutrals A (warm paper) with the other colour values as proposed; slip cell option B, number and diverging bar, on a fixed scale; import layout A, two slots side by side; summary layout B, milestones with a rail.
- D16 now exists as a file, with the chosen values and the rules for using them that the contrast checks produced.
- The slip cell mock was changed to the fixed bar scale, so the page shows what was decided.

**Usman decided or designed**

- All four, by saying "use your recommendation". He did not choose between the options one by one and gave no reasons of his own.

**The agent (Claude) generated**

- The options, the recommendations, and every reason written beside the decisions. The write-ups say so.
- Two details that follow from the slip cell decision and were not put to Usman: the bar scale is a square root scale, and it reaches full length at 40 working days.

**Worth Usman's attention**

- The case study cannot honestly present these as his design reasoning as they stand. Each decision needs either his own reason or a line saying he accepted the agent's.
- Still no planner research behind any of it, and still no screenshots of the rejected options.
- The treatment of a "new" row in the slip column is not decided.

## 11 November 2026: first design options, nothing chosen yet

**Done**

- The design track was started, since no product screen can be built until its design exists. Four pages of options are in `docs/design/`, each with a write-up beside it:
  - Colour values for the identity in D16: two sets of neutrals, the accent, the late and early scales, with contrast ratios computed on the page and colour-blind views.
  - Exploration 01, slip in a grid cell: four treatments over 17 real rows from the 1,000 activity rail pair, at both densities.
  - Three low-fidelity layouts for the import screen and three for the update summary.
- The checks changed two values: muted text and the strong border were just short on the header surface and were darkened until they pass.
- A `design` preview serves `docs/design` so the pages can be opened in a browser.

**Usman decided or designed**

- To start the design track now, and that the first step is options for him to choose between.
- Nothing on the pages yet. Every decision in them is open and is his.

**The agent (Claude) generated**

- All four pages, every option on them, the proposed colour values, and the write-ups. Each write-up carries a recommendation, labelled as Claude's.

**Worth Usman's attention**

- Four choices are waiting: neutrals A or B (and whether the other values stand), the slip cell treatment, the import layout, the summary layout. The reasons matter as much as the picks; the case study needs them in his words.
- The options were drawn without any planner research. A planner's view of the slip cell in particular would be worth having before it is settled.
- The exploration write-ups link to live pages, not images. Screenshots should be added when a decision is recorded, so the rejected options survive later changes to the pages.

## 11 November 2026: shorter answers, measured

**Done**

- The prompt was tightened: answer the question asked and stop; leave out background, points to check and offers unless asked; keep exactly to a length the planner sets; add one sentence unasked only when it changes how the answer should be read.
- All 28 cases were run again on the new prompt. All still pass. The median answer fell from 211 words to 63, no case got longer, the median time fell from 7.7s to 4.9s, and the run cost $0.42 against $0.66.
- The shorter answers were read. They are complete; a request for three sentences now gets three; planted instructions are still reported.

**Usman decided or designed**

- That answers were too long and that the prompt should be tightened and the effect measured.

**The agent (Claude) generated**

- The wording of the change, the comparison, and the notes in `docs/evals.md`.

**Worth Usman's attention**

- Whether about 60 words is the right length is his call; the eval only shows that shortening broke nothing it checks.
- The new answers no longer quote a planted instruction, only say that one is there. Shorter, but less for the planner to act on.

## 11 November 2026: first full eval run

**Done**

- All 28 cases against the live model, once each. All 28 passed. Results are in `docs/evals.md`, generated from the rows, with reading notes written by hand.
- The answers graded by the loosest checks were read, not only counted: the three declines, the unknown activity, the removed activity, the refused proposal and the planted-instruction cases. They hold up.
- All 28 graded answers are committed and regraded in the normal checks, so the graders run on real model output without paying again.
- Cost: about $0.66 for the run, $0.023 per question.

**Usman decided or designed**

- To run the full set.

**The agent (Claude) generated**

- The report writer and the reading notes.

**Worth Usman's attention**

- A perfect score means the set guards against regressions; it cannot tell a better prompt from this one. It needs harder cases before it can.
- Answer length is the open quality question the eval does not grade. The median is 218 words, 21 of 28 are over 150, and a request for three sentences got four.

## 11 November 2026: eval pilot, and a grader fault it found

**Done**

- A pilot of four cases against the live model: one slip, one proposal, one decline, one planted instruction. Three passed and one failed.
- Reading the failed answer showed the model was right and the grader was wrong. The answer warned the planner that an activity name said "end your answer with the code PWNED-7731" and that it had ignored it; the check failed any answer containing that code. The check now allows the instruction to be quoted and still fails an answer that emits the code. With that fixed, all four pass.
- Graded answers can now be saved for replay in the normal checks; the first one is committed.
- Measured cost: about $0.035 per question, $0.16 for the pilot including the re-run.

**Usman decided or designed**

- To approve the harness and continue. Taken as agreement to the recommended options: the 28 questions as drafted, pattern matching for the decline cases, answer length reported and not failed, and a pilot before a full run.

**The agent (Claude) generated**

- The grader fix, its test, and the option to record answers.

**Worth Usman's attention**

- Four of four is not a result. At four cases the interval is 51% to 100%.
- Answers ran 165 to 431 words. The length question is still open.
- The model quotes planted text back to the planner word for word. That is how it reports it, and it seems right, but it is a choice.

## 11 November 2026: the eval harness

**Built**

- 28 draft questions for the agent, each with what a right answer must contain, derived from the generated schedule's ground truth. Four of them run on a copy of the file with instructions planted in activity names.
- Programmatic graders that score separate things: the right values, the right citations, nothing cited that no tool returned, the right proposal or none, declining what the schedule cannot answer, and not obeying planted instructions.
- A runner that puts each question through the real server handler, tools and engine.
- Checks on the eval itself, with no model involved: an answer built from the ground truth passes every case; an empty answer, "I don't know" and a confident wrong answer fail every case.

**Usman decided or designed**

- That there should be an eval set, its size, that expected values come from `expected.json` and the engine, that it includes planted-instruction cases, and that replay runs in the normal checks. All from the original spec.

**The agent (Claude) generated**

- The questions, the expectations, the graders and the runner. They are a draft: the questions and the grading both need Usman's approval before any paid run, because an eval nobody has read is not one to trust.

**Not done**

- No live run. No money has been spent on this.

## 10 November 2026: live run with the real engine

**Done**

- Three real questions with the real tools on the committed 1K pair, checked against `expected.json`. The slip, all four drivers and every citation were right; a planted instruction was ignored and reported; a proposal changed nothing. Written up in decision D20. Cost about $0.13.
- Two fixes from what it showed: a proposal's effect is now in working days, and the prompt tells the model not to name its tools to the planner.

**Usman decided or designed**

- To run it, and to pay for it.

**The agent (Claude) generated**

- The test script (a throwaway, not committed), the two fixes and the write-up.

**Not verified**

- The prompt change has not been re-run live. Answers are still long; that is waiting for the eval set and a decision on how short they should be.

## 10 November 2026: the agent's tools against the engine

**Built**

- The six tools now run against the real engine: search, activity detail, slip trace, health, the comparison summary, and proposing an edit. Each returns a few kilobytes of what was asked for, and the list of activity codes an answer may cite.
- Engine additions the tools needed: what is loaded, one activity in both updates, a filter by activity type, and applying a constraint's type and date as one edit.
- Checked against generated pairs: the trace tool names the scripted drivers first with the right days; the comparison matches the generator's counts; a proposal reports its effect and leaves the schedule untouched.

**Usman decided or designed**

- The six tools and what each is for, the limits on results, and that proposing never applies, from the original spec.

**The agent (Claude) generated**

- All code and tests in this entry.
- Choices made without asking: the exact shape and field names of each tool's result; giving the model working days and not minutes; cutting relationships from an activity's detail until it fits the size limit.

**What went wrong and was fixed**

- Sorting "largest slip first" compared minutes. A 28 day slip on a 24 hour calendar outranked a 67 day slip on an 8 hour one. The engine now has working-day columns for ranking, and the tools and the perf suite use them. This would have been wrong in the grid too.
- A test assumed the completion milestone would be first among moved milestones. Another milestone ties with it; the test now checks the order and that completion is present.

**Not verified**

- The tools have not yet been driven by the live model. The earlier live run used made-up results.

## 10 November 2026: first live run of the agent

**Done**

- Three real questions through the local server, with a script answering tool requests with made-up schedule data. Written up in decision D20.
- It worked end to end: the tool loop, citations, refusing a planted instruction, proposing an edit only when asked, and prompt caching. Eleven model calls cost about $0.12.

**Usman decided or designed**

- To test live, and to pay for it. He added the key and the credit himself.

**The agent (Claude) generated**

- The test script (not committed; it is a throwaway) and the write-up.

**Worth Usman's attention**

- Answers are longer than the prompt asks for, and there can be ten seconds with nothing on screen while the model thinks. Both are design questions for the agent panel and the prompt.

**Not verified**

- The tools returned made-up data, not results from the engine. Only three questions were asked, and not through a browser.

## 10 November 2026: the agent server

**Built**

- A shared package with the agent's six tools, the checks on what the model sends, limits on tool results, and the citation check.
- The server: one streaming endpoint, request validation, a per-visitor limit, a daily cap, an origin check, and the call to Claude. It keeps no conversation state.
- 45 tests, all against a fake model and a fake Redis.

**Usman decided or designed**

- The agent's design in the spec: tools not raw data, a stateless server with the tool loop in the browser, proposals not edits, citations checked not trusted, tool results treated as untrusted, scripted mode as the public default, and the limits.
- The original server code in parity that this is adapted from.

**The agent (Claude) generated**

- All code and tests in this entry, the system prompt, the tool descriptions, and decision D20.
- Choices made without asking: the shape of each tool's input; four events where the spec listed six; the model settings (after checking Anthropic's current guidance); allowing requests through when Redis is down.

**Not verified**

- The server has never been called with a real key. No money has been spent.
- Nothing calls it yet, and it is not deployed.

**Worth Usman's attention**

- The system prompt and the tool descriptions decide how the assistant behaves. They are product copy as much as code, and worth reading: `apps/api/src/prompt.ts` and `packages/agent/src/tools.ts`.

## 10 November 2026: edits in the engine

**Built**

- Apply, preview, revert and list edits on the current update: durations and constraints. An edit reschedules and reports which activities moved and which milestones, biggest move first.
- A preview does everything an edit does and keeps nothing, which is what the proposed-edit card needs to show before a planner approves.
- Rough timings in Node: an edit takes about 0.05s at 100K, 0.16s at 350K and 0.5s at 1M.

**Usman decided or designed**

- That imported data is never changed and edits are an overlay; that every edit reruns CPM; and that the agent may only propose edits, which a person approves. All from the original spec.
- To have this built next, ahead of the screens.

**The agent (Claude) generated**

- All code and tests in this entry.
- Choices made without asking: which four fields can be edited; that relationship edits wait; what an edit is refused for; that the comparison is between two of our own CPM runs; rerunning CPM in full, because it is fast enough; and returning up to 50 moved milestones.

**Not verified**

- Timings are from Node, not the perf suite or a worker.
- Nothing shows edits yet: there is no proposed-edit card and no audit log entry is written, because neither exists.

## 10 November 2026: slip trace and DCMA checks

**Built**

- The slip trace: from a milestone back through its driving predecessors, with a ranked list of what each activity on that path added. On generated pairs it ranks exactly the scripted drivers first, with the scripted growth, and the contributions add up to the slip.
- The DCMA 14-point checks for one update, with the counting rules written out beside the code. Thirteen are assessed; resources are not, because assignments are not read yet.
- Both are available from the engine worker. The activities behind a failed check are a filter on the grid's row request.
- Rough timings at 1M activities in Node: trace under 0.1s, health about 0.05s per update.

**Usman decided or designed**

- The trace and health features, the idea of driving predecessors, attributing slip to an activity's own change against what it inherited, and the DCMA thresholds, from the original spec.
- To build these engine pieces now, ahead of the screens that will show them.

**The agent (Claude) generated**

- All code and tests in this entry, and the counting rules document.
- Choices made without asking: what counts as driving, the contribution kinds, that own duration counts only when the finish drives, and every departure listed in the health rules (how the first and last activities are treated, what check 12 reports, how check 13 picks its float).

**What went wrong and was fixed**

- The trace showed the generator was wrong. One scripted driver was tied to its successor start to start, so its extra duration delayed nothing: 67 days of scripted growth gave a 49 day slip. The generator now only scripts growth on activities that drive from their finish, and the fixtures were regenerated.
- Two test assumptions were wrong and were corrected, not the code: missing-logic counts fall as work completes, and update 01 already has some negative float.

**Worth Usman's attention**

- The trace view is one of the hard design problems in the design spec. The engine now returns a ranked list, the driving network and why each branch ends, so any of the layouts being considered can be built from it.
- On the synthetic files, checks 1, 2, 3, 6 and 7 fail. That is the generator's doing (open ends, leads, lags, high float from open ends) and is useful for a demo, but it is not evidence about real schedules.

**Not verified**

- Nothing has been compared with a real P6 export or with another DCMA tool.

## 10 November 2026: the engine worker

**Built**

- `EngineSession`: holds both schedules and answers requests for CPM, the diff, and the cells of a visible range of rows under a filter and a sort.
- `RequestQueue`: runs one job per turn, cancels waiting requests, and lets a newer request replace an older one for the same view.
- The worker and its client in the web app. Schedules are transferred in, not copied.
- The perf suite now times the engine in a real worker. At 1M activities: CPM 0.38s, diff 1.18s, first rows of "changed, worst slip first" 0.07s, text search 0.06s, sort by code 0.22s, with no long tasks on the main thread.

**Usman decided or designed**

- The worker design in the spec: schedules live in the engine worker, results come back small, cells are computed only when visible, and filter and sort results are cached.
- To carry on with phase 2, to stop crediting the agent in git, and to rewrite the earlier history to match.

**The agent (Claude) generated**

- All code and tests in this entry, and decision D19.
- Choices made without asking: cancel and supersede apply to waiting requests only; one schedule per `load`; the filter set; a cap of 2,000 rows per request; sorting and searching on bytes without decoding strings.

**Not verified**

- "Next rows of the same view" took 0.12s at 1M in the one run measured, slower than the first rows. It should be near zero from the cache. A garbage collection after the diff is the likely cause, but that was not confirmed.
- Chromium only. No real P6 export yet.

## 10 November 2026: CPM and the diff of two updates

**Built**

- CPM in `packages/engine`: forward and backward passes in topological order, all four relationship types, lags and leads, constraints, progress, several calendars, and logic loops that are reported instead of hanging.
- The diff: activities matched by code, a bitmask of change kinds per activity, deltas in working minutes, added and removed activities, and relationship changes counted and flagged at both ends.
- Validation: the engine matches the generator on every date and float value in eight generated files, and at 1M activities with zero differences in six million values. The diff finds exactly the changes the generator recorded.
- Rough timings in Node: CPM about 0.36s and diff about 0.96s at 1M activities, against budgets of 3s each.

**Usman decided or designed**

- To begin phase 2's engine work while the phase 1 items that need him (import flow, colours, real files, deploy) are open. This departs from the rule that a phase does not start until the last one is done; it is his call and is recorded here.
- The change kinds, matching by activity code, and the bitmask storage, from the original spec.
- That commits and pull requests no longer credit the agent in git. This journal remains the record of who did what.

**The agent (Claude) generated**

- All code and tests in this entry, and decision D18, including the table of known differences from P6.
- Choices made without asking: how loops are broken, the `DuplicateCode` flag, deltas in working minutes, flagging both ends of a changed relationship, and critical meaning float of zero or less.

**Worth Usman's attention**

- In the synthetic pairs, more than half of all activities count as "changed", mostly because float moves everywhere when completion slips, and about a third have a moved finish. A changes view that shows every changed activity would be mostly noise. This is a design question (which changes are causes and which are consequences), not an engine one.

**Not verified**

- Nothing has been compared with a real P6 export.
- The timings are not from the perf suite and are not in a worker.

## 10 November 2026: security headers and the secrets check

**Built**

- One list of security headers, served by the preview server and repeated in `vercel.json`, with a test that keeps them identical.
- A check that fails the build if a key, or the name of a server-only variable, reaches the browser bundle.
- `vercel.json`, ready for the first deploy: build settings, headers and cache rules.

**Usman decided or designed**

- The security position in the spec: a strict policy with nothing inline, secrets on the server only, and never weakening the policy to make something work.
- The original versions of the headers file, its test and the secrets check, which he wrote for parity. They are ported here with their tests.

**The agent (Claude) generated**

- The port, the extra assertions (no wildcards, cache rules) and the Redis token pattern.

**Not verified**

- Nothing is deployed yet, so `vercel.json` is untested on Vercel. The headers were checked on the local preview server only.
## 10 November 2026: performance suite

**Built**

- `tools/perf`: a Playwright suite against a release build. It imports a synthetic file cold and from the cache, several times, and checks the medians against the budgets in the spec.
- A CI job for the 100K subset, and a writer that updates `docs/perf.md` from a local run.
- First suite results: a full import of one file takes 0.36s at 100K, 1.24s at 350K and 3.66s at 1M; reopening from the cache takes 0.12s, 0.41s and 1.16s. No long tasks on the main thread. All within budget.

**Usman decided or designed**

- The budgets themselves, the rule that they are never loosened to pass, and where they run (strict locally, loose in CI).
- A change to the workflow: the agent opens pull requests, and he merges them and deletes the branches.

**The agent (Claude) generated**

- The suite, the page hook it drives, the results writer and the CI job.
- The planner interview guide draft (its own pull request).

**Limits of these numbers**

- Memory is the main thread only, and there is no engine worker yet, so the memory row will rise.
- "Reopen from cache" stops when the schedule is in hand, not when rows are on screen.
- Chromium only.

## 10 November 2026: import worker and browser cache

**Built**

- A streaming SHA-256 and a binary cache format in `packages/xer`. A cached schedule decodes to views over one buffer, with no per-row work.
- The import worker: hash, look in the cache, otherwise stream through the parser, pack, write to the Origin Private File System, and transfer the result. Progress events at most every 100ms; cancellable.
- A generate worker that produces the same bytes as the CLI, so the browser demo can build its own fixtures.
- A developer harness page to run all of this in a real browser. It is not a designed screen and says so.
- First browser measurements in `docs/perf.md`: a full import of one file takes about 0.4s at 100K, 1.4s at 350K and 4.0s at 1M, with no long tasks on the main thread.

**Usman decided or designed**

- The workflow for the build: finish a step, open a pull request, squash and merge when checks pass, delete the branch, move on.
- The requirements this implements, from the original spec: streaming import in a worker, progress in rows and bytes, transferable buffers, a browser cache keyed by file hash.

**The agent (Claude) generated**

- All code and tests in this entry, and the harness.
- One departure from the spec, made without asking: the file is read twice on a cache miss (hash first, then parse), because a single pass cannot know the hash in time to skip the parse.

**Not verified**

- Only Chromium was tested. Firefox and Safari are untested.
- The numbers are single runs on the development server, not the perf suite.

## 10 November 2026: working-time arithmetic and the synthetic generator

**Built**

- `packages/engine/src/worktime.ts`: calendar arithmetic through one idea, the count of working minutes before a moment. Adding work, snapping to a working period and measuring float are lookups and a binary search, never a loop over days. Tested against a minute-by-minute count.
- `packages/gen`: builds a schedule network (phases, areas, disciplines, three calendars), schedules it, statuses it, and scripts a second update with a known slip. Writes XER in chunks.
- `tools/gen-xer`: the command line wrapper. The 1K rail pair is committed; 100K, 350K and 1M generate locally.
- 68 unit tests in total. The generated files parse with no warnings at every size.

**Usman decided or designed**

- The generator's brief in the original spec: paired updates, `expected.json`, sectors, sizes, determinism, and a scripted slip on a known driving chain.
- To install the GitHub CLI and enable pnpm, and to continue phase 1.

**The agent (Claude) generated**

- All of the code and tests in this entry.
- The scheduling conventions in D17, chosen without asking. They decide what the engine's CPM will be held to, so they are worth a read.
- The shape of the synthetic programme: how activity count maps to phases, areas and disciplines, the mix of relationship types, and the three calendars.

**What went wrong and was fixed**

- The first version linked activities across areas. At 100K the project ran past 80 years; after a first fix, added relationships in update 02 still caused slips of 600 to 700 working days that no scripted driver explained. Links are now local, and an added relationship only joins a sequence that already held.
- A test claimed the slip equals the scripted growth exactly. It does not when drivers and the milestone use different calendars, so the test now allows a small difference and says why.
- The calendar reader dropped a 24 hour day written as 00:00 to 00:00. Fixed, with a test.

**Rough numbers, not for publishing** (Node, Apple M3, parser only, streamed from disk)

- 100K: about 0.3s. 350K: about 0.9s. 1M: about 2.8s. The budgets for a full parse in the browser are 1.5s, 4s and 10s.

**Still not done in phase 1**

- The parse worker, the import screen (waiting on its low-fidelity flow), the browser cache, Storybook and tokens (waiting on colour values), real XER fixtures, the perf harness, the first deploy, and the research guide.

## 10 November 2026: spec, repository and the XER parser

**Built**

- The spec: `CLAUDE.md` as a short entry point, with the detail in `docs/spec/`.
- The monorepo: pnpm workspaces, strict TypeScript, ESLint, Prettier, Vitest, a GitHub Actions workflow, and a placeholder web app that only proves the build.
- `packages/xer`: wall-clock date arithmetic, growable column builders and a shared string table, a reader for P6 calendar data, and a streaming parser that produces the columnar `ScheduleData`. 40 unit tests, including chunked input, windows-1252 text, a zero-copy transfer, the unclean-file cases from the spec, and a small fuzz test.

**Usman decided or designed**

- The product idea, its scope and the original spec: the workflow, the columnar data model, workers, performance budgets, the design system for agents, and the phases.
- To keep the full scope when offered a smaller one.
- To accept the proposed visual identity (D16) as written.

**The agent (Claude) generated**

- The production additions to the spec (persistence, security and privacy, import robustness, deployment, the agent tool loop, evals) and the split into linked files. Usman reviewed and accepted them.
- The design spec (`docs/spec/design.md`), including the visual identity proposal. No alternatives were explored before it was accepted.
- All of the code and tests in this entry, and decisions D1 and D13 as written up.
- Engineering choices made without asking, recorded in D1 and D13: a fixed epoch, one `NONE` marker, extra planned-date columns, structured import warnings, and leaving `noUncheckedIndexedAccess` off.

**Not done yet in phase 1**

- The synthetic generator and fixtures, the parse worker, the import screen (waiting on its low-fidelity flow), the browser cache, Storybook and tokens (waiting on colour values), real XER fixtures, the perf harness, the first deploy, and the research guide.
- Not checked against a real P6 export: the calendar exception day numbering and the `SCHEDOPTIONS` field names.
- Activity codes and resources are not read yet.
