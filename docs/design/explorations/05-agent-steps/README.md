# Exploration 05: agent steps

Status: **decided on 14 November 2026: option A, steps folded into one line, unverified codes marked in place.**

## Problem

The assistant answers by calling tools against the loaded schedule, then writing. A planner reads its answer in a narrow panel beside their work and has to be able to trust it, or see exactly where not to, without reading the working. Two questions: how much of the working to show by default, and how a grounded statement looks different from one that is not. The constraint that makes it hard is that grounding is only partly checkable: an activity code can be checked against the tool results mechanically, but whether a sentence of prose is supported by a result cannot be checked reliably, and a design that implies otherwise looks more certain than the data is.

Fixed by the spec, not chosen here: the assistant never states a date, duration or float that did not come from a tool result; a cited code not found in those results is shown as unverified; "the data does not show this" is a designed answer, not an error; a scripted answer is labelled as not AI.

## Options

All three are on one page at the panel's real width, with a switch between a grounded answer, an answer with one code that is not in the results, and a question the data cannot answer: [options.html](options.html). Run the `design` preview and open `/explorations/05-agent-steps/options.html`.

| Option | Shows by default | Grounded or not | Does well | Does badly |
|---|---|---|---|---|
| **A. Steps folded into one line; unverified codes marked in place** | "Worked for 3s, 2 steps", then the answer | Chips for verified codes; an unverified code is plain text, underlined, with "unverified" beside it | Quiet; the answer leads; the one check that can be made mechanically is shown where it matters | Figures are grounded by rule but nothing shows which result each came from |
| **B. Steps shown while working, then folded; each sentence marked** | The steps as they happen, folded when done | Every sentence names its tool; a sentence with none is dashed | Most transparent; the line between data and the assistant's own reasoning is visible | Noisy at panel width; matching sentences to results depends on the model marking them, which can be wrong |
| **C. Answer first, an evidence list beneath** | Clean prose, then the facts with their chips and values | Figures underlined and listed with their source; an unverified code listed as "not in the data" | Reads cleanly; matches the Finish update paragraphs | The unverified code is flagged away from where it was written; pulling figures out of prose is the hard part again |

Things the mock made visible:

- Only activity codes can be verified mechanically. B and C both lean on matching prose to results, which is a judgement the model makes and the screen cannot check; drawn confidently, that is the "looks more confident than the data" the spec warns against.
- An unverified code needs to be flagged where it is written. A reader who never looks at the evidence list should still see it.
- The "data cannot answer" case is clearest as its own boxed answer that says so first, then gives what the data does show.

## Decision

**Option A, steps folded into one line; unverified codes marked in place.** Chosen by Usman on 14 November 2026 ("A, steps folded"), on Claude's recommendation and without reasons of his own. The reasoning is Claude's: only activity codes can be checked against the data mechanically, so A marks only what can honestly be checked, where it is written; B and C imply a sentence-by-sentence matching the screen cannot verify.

Built as drawn, with one addition: under an answer with unverified codes, a line says how many there were and why they are marked.

## What changed

Nothing yet.
