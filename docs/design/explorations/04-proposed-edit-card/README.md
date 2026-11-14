# Exploration 04: the proposed edit card

Status: **decided on 14 November 2026: option B, the milestones it moves as a small table.**

## Problem

The assistant can propose a change to one activity: a new original or remaining duration, or a constraint. It never makes the change. The planner approves or rejects it; approving reruns the schedule; both are written to the audit log. Before anything changes, the engine has already worked out the effect (a preview): how many activities move, the project finish before and after, and every milestone that moves. The card has to give enough of that to approve with confidence, without becoming a form, and a change that makes things worse must not look like one that helps.

## Options

All three are on one page at the panel's width, with a switch between a change that recovers time, one that makes things worse, one that moves nothing, and one already approved: [options.html](options.html). Run the `design` preview and open `/explorations/04-proposed-edit-card/options.html`.

| Option | Shows | Does well | Does badly |
|---|---|---|---|
| **A. One sentence of effect** | The change, the reason, the milestone that moves most and how many more | Smallest; reads in seconds | Mixed effects hidden; a worsening change looks almost like a recovery |
| **B. The milestones it moves, as a small table** | The change, the reason, every milestone it moves with the slip cell, the project finish before and after | Mixed effects visible; direction by position as well as colour; "this makes the project finish later" said in words | Taller; several proposals fill the panel |
| **C. Editable before approving** | The proposed value in a box, the reason, the effect on request | The planner can adjust the idea without asking again | It is a form, which the spec rules out; the effect goes stale; who chose the value gets muddy |

Things the mock made visible:

- The direction of the effect is the most important fact on the card, and in A it is a single sign in a sentence.
- B reuses the slip cell from the grid, so a milestone moving later looks the same here as everywhere else.
- After approval the card should stay, saying what happened and offering Undo, so the conversation remains a record. The engine already supports reverting an edit.

## Decision

**Option B, the milestones it moves, as a small table.** Chosen by Usman on 14 November 2026 ("B, milestone table"), on Claude's recommendation and without reasons of his own. The reasoning is Claude's: milestones are what a planner is accountable for, and B is the only option where a change that helps one and hurts another is visible before approving.

## What changed

Nothing yet.
