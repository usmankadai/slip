# Exploration 10: the activity drawer

Status: **decided on 15 November 2026: option C, led by what changed.**

## Problem

A planner selects a row in the changes grid and asks "what happened to this one, and why?". The UI spec puts the answer in a drawer under the grid and Gantt, with five parts: General, Changes, Predecessors, Successors and Trace. The drawer is also where the Gantt's facts become text for anyone who cannot use the canvas (relationships especially), so nothing can be left out. The hard part is height: the grid and Gantt must stay usable above it, which leaves about 300px, and the answer usually needs two facts at once, such as a duration that grew and a predecessor that was added.

## Options

All three are on one page at 1280px, with the drawer under four rows of the grid, and a switch between an activity that moved with changed logic, one new in update B, and one that did not change: [options.html](options.html). Run the `design` preview and open `/explorations/10-activity-drawer/options.html`. Every option uses only what the engine's `activity` request already returns.

| Option | Does well | Does badly |
| --- | --- | --- |
| **A. Five tabs, as the spec lists them, opening on Changes** | Exactly the spec; each part can be as long as it needs; counts on the tabs say where to look | One part at a time: the grown duration and the added predecessor are two tabs apart, and that pairing is often the answer |
| **B. Everything at once, in three columns** | Fields, predecessors and successors side by side, so the cause is usually in view without a click | Dense; unchanged fields take room; narrow columns wrap long names; Trace is only a button |
| **C. Led by what changed, with the reason; the rest a tab away** | Answers the question first: changed fields, changed logic and one sentence from the trace, with Logic and Everything tabs for the rest | Departs from the spec's five tabs; the sentence needs a trace run on every selection |

Things the mock made visible:

- In all three, a changed field is marked by a bar on its left and heavier text, and a removed link is struck through and labelled, so nothing depends on colour.
- The engine returns at most 30 links each way. Each option has to say "and N more" rather than imply it shows all of them.
- An activity that did not change makes A's Changes tab and C's first tab almost empty. Both need a plain sentence there, and C still needs its other tabs to be worth opening.
- C's sentence ("its slip came mostly from its own longer duration and the new predecessor") is the most useful line on the page and the least certain: it depends on the trace attributing slip to causes well, which the trace screen does for milestones but has not been checked for every activity.

## Decision

**Option C, led by what changed, with the reason; the rest a tab away.** Chosen by Usman on 15 November 2026 ("C, led by changes"), accepting Claude's recommendation. The reasons are Claude's, which he accepted.

- It answers the planner's question first: which fields changed, which links were added or removed, and one sentence on why the activity moved.
- A was rejected because the cause and its effect sit on different tabs. B was rejected as too dense for 300px.
- The departure from the spec's five tabs is recorded here and in the UI spec: General, Predecessors and Successors become Everything and Logic; Changes and Trace become the first tab.
- The sentence on why it moved comes from the trace. If it proves weak for ordinary activities, the first tab keeps an "Open the trace" button in its place.

## What changed

- 15 November 2026: built. Two differences from the mock. The header does not say which milestone the activity drives, because that needs a second search; the trace sentence names the largest causes instead. Link changes are listed only when the engine has listed every link both ways (30 or fewer); otherwise the drawer says the logic changed without comparing link by link. The sentence on why it moved arrived within half a second at 350,000 activities, so it stays.
