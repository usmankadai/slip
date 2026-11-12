# Exploration 03: the trace view

Status: **decided on 12 November 2026: A, ranked causes, leading, with B, the driving path, beneath it as the evidence.**

## Problem

A planner picks a milestone that moved and asks why. The engine walks back along the driving path and works out, for each activity on it, how much slip it added of its own (it took longer, its duration grew, its logic changed) as distinct from the slip it passed on from its predecessor. A driving path can be dozens of activities long; the cause is usually a handful of them. The design spec fixes the hierarchy: the ranked causes are the answer, and the chain is the evidence. The view has to keep those two apart, show own slip separately from inherited slip, and cope with two awkward cases: an activity that recovered time, so the contributions do not simply add up, and a tail of contributors too small to matter one by one.

## Options

All three are on one page over the same trace, with a switch between the real case (four causes, +67 days) and a made-up awkward one (a recovery and several small contributors, +41 days): [options.html](options.html). Run the `design` preview and open `/explorations/03-trace-view/options.html`.

| Option | Own and inherited | Does well | Does badly |
|---|---|---|---|
| **A. Ranked causes, with the chain folded away** | Only own slip is listed; activities that passed slip on are one line | It is the answer, in the order a planner would report it; short however long the chain | Sequence is lost; shares need explaining when there is a recovery; evidence is a click away |
| **B. The driving path, with own and inherited slip on each activity** | Both, on every activity, as a grey bar and a coloured piece | Shows how the slip built up; it is the evidence itself | The planner must find the answer in it; grows with the chain; the layout the spec warns against leading with |
| **C. A waterfall of contributions** | Own is each bar; inherited is where it starts | The pieces visibly make the whole; a recovery steps back | Cannot be both largest first and in path order; many thin steps; little room for names |

Things the mock made visible:

- With a recovery, "share" is ambiguous. In the awkward case the causes add 53 days and a recovery takes back 12, for a net 41. A share of 41 would exceed 100% for the largest cause; a share of 53 does not sum to the milestone figure. A used share of slip added, and left the recovery without one.
- B's folding matters more than its bars. "2 activities passed it on unchanged" is what stops the path being a wall.
- C is the clearest picture of own against inherited, and needs no legend, but it is a chart of the sum, not a list of causes.
- The reason the trace stops (the data date, a constraint, finished work) belongs in every option. It is the end of the explanation.

## Decision

**A leading, with B beneath it, opened on request.** Chosen by Usman on 12 November 2026 ("A with B beneath"), on Claude's recommendation and without reasons of his own. The reasoning is Claude's: it is the hierarchy the spec asks for, the answer first in rank order and then the path for anyone who wants to check it. C was not chosen because it cannot be both largest first and in path order; its idea survives in B, where each activity's bar starts from the slip it inherited.

Settled while building, by Claude, and open to change:

- **Share** is each cause's part of the slip that was added. An activity that recovered time has no share. When the causes do not add up to the milestone's slip, a line says how many days are not explained.
- **Folding.** The five largest causes are always listed; beyond that, causes under 3 working days fold into one line that can be opened.
- **Order in B** is furthest back first. The driving path can branch, so "inherited" is the activity's own finish slip less what it added, not a running total.

## What changed

Nothing yet.
