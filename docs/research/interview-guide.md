# Planner interview guide

A draft for Usman to edit before the first call. The aim is to learn how planners review a schedule update today, so Slip is designed around what they do and not around what we assume. Rules for using what is learned are in [docs/spec/design.md](../spec/design.md).

## Who to talk to

Three to five people who have reviewed monthly schedule updates on large programmes: planners, planning managers, project controls leads, or delay analysts. A mix of contractor side and client side is useful, because they read the same update for different reasons.

## Before the call

- Say what it is: a 30 minute conversation for a portfolio project, not a sales call.
- Ask permission to take notes and to quote them without their name or employer.
- Do not ask for real schedules. If they offer one, decline unless it is cleared for sharing.

## Opening (2 minutes)

- What is your role, and what kinds of programme do you work on?
- Roughly how large are the schedules you deal with? (Activities, number of updates a year.)

## The last update you reviewed (10 minutes)

Ask about one real, recent occasion, not the general case. People describe what they actually do when they talk about a specific time.

- Think of the last update you reviewed. What arrived, and from whom?
- What was the first thing you looked at? Why that?
- Walk me through what you did next, step by step.
- Which tools did you have open? (P6, Excel, a comparison tool, a PDF, email.)
- How long did the whole review take?
- What did you have to produce at the end, and for whom?

## Where it is slow or risky (8 minutes)

- Which part took longest?
- Was there a point where you were not sure you could trust what you were seeing?
- Has a change ever slipped past a review and caused a problem later? What was it?
- When a key date moves, how do you find out why? How confident are you in the answer?
- How do you tell a real change from noise, when thousands of dates have moved?
- Do you check schedule quality (logic, constraints, float) on each update? With what?

## The report (5 minutes)

- What goes in the written narrative for an update? Who reads it?
- How much of it is written fresh each month, and how much is copied forward?
- When someone challenges a statement in it, how do you back it up?

## AI and trust (3 minutes)

Ask this late, so it does not colour the earlier answers.

- Have you used an AI assistant on schedule work? What for? What happened?
- What would it have to show you before you would rely on its answer?
- Is there anything you would never let it do?

## Closing (2 minutes)

- If you could change one thing about reviewing updates, what would it be?
- Is there anything I should have asked?
- Would you look at a working version in a few weeks and tell me where it is wrong?

## After the call

Within a day, write a note in this folder named `YYYY-MM-DD-role-sector.md`:

```
Who          role and sector only
Context      schedule size, update frequency, tools
What they do the steps of their last review, in order
Slow or risky what took time or felt unsafe
Quotes       their words, exactly
Surprises    anything that contradicts the current design
```

Then add each finding to `findings.md` with the design change it leads to, or "no change" and the reason.

## What we are trying to learn

Each of these is an assumption the current design rests on. A call that overturns one is a good call.

1. Planners start an update review from the key milestones, not from a list of all changes.
2. "Why did this date move?" is the hardest question to answer with today's tools.
3. Schedule quality checks are run on each update, and the change in quality matters more than the score.
4. The narrative is a real deliverable, and backing up its claims is tedious.
5. A planner will only accept an AI answer that points at specific activities.
6. Nobody wants an assistant that changes the schedule without asking.
