# Exploration 12: the mention picker

Status: **decided on 17 November 2026: option A. Built.**

## Problem

The product spec says only that `#` opens an activity, WBS or code picker in the assistant's input. A planner wants to point at the activity they mean without copying its code. At 350,000 activities a name such as "Install catenary" can match a thousand rows, so the picker has to narrow fast and say how many it is not showing. What is picked must reach the model as a code it can look up and cite, and the planner must still be able to read their own question. The panel is 420px wide, and the input is a plain textarea today.

## Options

All three are on one page in the panel at its real width, with a switch between typing `#catenary`, no match, the 350,000 activity case, and after choosing, which also shows what the model receives: [options.html](options.html). Run the `design` preview and open `/explorations/12-mention-picker/options.html`. Every option uses the grid's own engine search over codes and names, sorted by slip, so no new index is needed.

| Option | Does well | Does badly |
| --- | --- | --- |
| **A. A list at the caret; the code goes into the text** | The smallest change: the textarea stays, and the question reads exactly as it is sent; the code is what the model already cites | The question fills with codes, which are hard to read back; activities only |
| **B. A list at the caret; the choice becomes a chip** | Reads like the question meant, with the activity's name; tabs for activities and WBS, as the spec lists | Needs an editable field that holds chips, which is hard to make accessible and to edit by keyboard |
| **C. A tray above the input; choices are attached** | The activity just selected in the grid, and the milestones, are one click away; the question stays plain words | Not a `#` in the text, which the spec names; the link between a word and the activity it means is lost |

Things the mock made visible:

- Sorting matches by slip puts the activities a planner is most likely asking about first, and lets the list say "1,204 match, showing the 6 that slipped most" honestly.
- The activity already selected in the grid is the most likely thing to ask about. Only C offers it without typing, but A or B could add it as the first suggestion when `#` is typed with nothing after it.
- What the model receives differs: A sends the code alone, B and C send the code with the name. Names already reach the model through its tools, so this changes nothing about what leaves the browser.
- WBS mentions need the engine to search WBS names, which it does not do yet. A and C could start with activities only.

## Decision

**Option A**, chosen by Usman on 17 November 2026. He accepted the recommendation, so the reasons are the agent's: it keeps a plain textarea, which is the most robust and accessible field; the question reads exactly as it is sent; and the code is what the model already looks up and cites.

Taken from option C: typing `#` with nothing after it lists the activity selected in the grid first, marked "Selected in the grid", then the activities that slipped most.

Activities only for now. WBS mentions wait until the engine searches WBS names.

## What changed

- `MentionInput` in `packages/ui`: the textarea, the list above it, and the caption that says how many matched. It only draws; the caller searches. Contract in its README.
- The list opens above the box rather than at the caret itself: the box is at the foot of a 420px panel, so the two are nearly the same place, and the list is never clipped.
- `useMentions` in the assistant asks the engine for six rows of update B, filtered by the text after `#` and sorted by finish slip, with a 120ms pause after the last key. A newer search replaces an older one that has not started.
- Arrows move, Enter or Tab chooses, Escape closes the list but not the panel. Enter with no list open asks the question.
- Nothing new leaves the browser: the code is part of the question, which was already sent in live mode.
