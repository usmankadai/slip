# Design

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).

Slip is a portfolio piece for a design role. The engineering proves it scales; this file is about proving design judgement. A reviewer should be able to see **what was decided, what the alternatives were, and why**, not only a finished interface.

Related: interaction rules are in [UI principles](ui.md); tokens, components and checks are in [design system](design-system.md).

**Who decides:** everything in this file is Usman's decision. Items marked *Proposed* are starting points written by an agent and are not final until Usman confirms them and removes the mark. Agents implement decisions here; they do not make them. If a task needs a design decision that is not recorded, stop and ask.

---

## Design goals

In priority order. When two conflict, the higher one wins.

1. **Answer the planner's question first.** Every screen has one primary question (listed under key screens). The answer is the most prominent thing on the screen, readable in under five seconds.
2. **Show the evidence.** Every number, claim and agent answer leads to the activities behind it in one click.
3. **Stay calm at scale.** A million activities should feel the same as a thousand: no spinners that block, no layout that jumps, counts that are honest about what is hidden.
4. **Keep the human in charge.** Nothing changes the schedule without an explicit approval, and everything that happened can be found afterwards.
5. **Dense, not cramped.** Planners want many rows on screen. Density comes from tight, consistent rhythm and alignment, not from shrinking text below what is readable.

---

## Visual identity

Slip must look like it belongs in the same category as professional planning tools, and must not look like Planlab. Planlab's public look is dark navy with peach and deep green and a geometric sans; avoid all of those as identity colours.

**Confirmed by Usman on 10 November 2026 (D16).** The starting proposal was drafted by an agent and accepted as written, without alternatives being explored first. Say so in the journal and the case study. Exact colour values are still to be chosen when the tokens are built, and must pass the contrast and colour-blind checks.

| Element | Decision | Reason |
|---|---|---|
| Character | A quiet working surface: light, flat, paper-like. Colour is reserved for data. | In a review tool the data should be the loudest thing. If chrome is neutral, a warm bar always means "late". |
| Surfaces | Warm off-white base with three slightly darker steps for panels, headers and hover | Softer than pure white for all-day use; warm neutrals separate Slip from the cool blue-grey of most enterprise tools |
| Text | Near-black ink, two muted steps | Contrast of at least 7:1 for primary text at 12 to 13px |
| Accent | One accent only, a violet, used for selection, focus and primary actions | It must not be read as data. Warm means late and blue means early, so the accent has to sit outside both. |
| Data colour | Late: amber to red, five steps. Early: light to deep blue, five steps. No change: neutral grey. Critical: a distinct dark red with a pattern. | Diverging scale with a neutral middle; survives the common forms of colour blindness when paired with sign and value |
| UI typeface | Inter (variable, self-hosted) | Designed for small sizes on screens, has true tabular figures, and has a slashed zero option for codes |
| Mono typeface | JetBrains Mono (self-hosted), for activity codes and numbers in the agent panel | Clear distinction between 0 and O, 1 and l, which matters in task codes |
| Type scale | 11, 12, 13, 14, 16, 20px. Grid body is 12px in compact and 13px in comfortable. | Small enough for density; 11px is the floor and is used only for secondary labels |
| Shape | 4px radius on controls, 6px on cards, 0 in the grid | The grid is a table and should read as one |
| Elevation | Borders, not shadows, except for floating layers (menus, popovers, the drawer) | Keeps a dense screen flat and legible |
| Motion | 120ms for state changes, 200ms for panels, none for data. All off under reduced motion. | Motion explains where a panel came from; it should never delay a number |
| Icons | One outline set at 16px, 1.5px stroke | Consistency at small sizes |
| Name and mark | Wordmark "Slip" set in the UI typeface; a simple mark of two offset bars (a bar and its baseline) | The mark is the product: this update against the last one |

Write this up as `docs/decisions/D16-visual-identity.md` in phase 1. If the identity is revised later (for example after seeing it on real screens), keep the earlier version and the reason for the change in `docs/design/explorations/identity/`.

---

## Key screens

Each screen answers one question. Design the answer first, then the rest.

| Screen | The planner's question | The answer, most prominent | Then | Must not |
|---|---|---|---|---|
| **Import** | "Did my files load, and can I trust what loaded?" | Two slots, A and B, each with project name, data date and activity count as soon as they are known | Progress in rows and bytes; the import report with warnings | Hide warnings behind a success tick |
| **Update summary** | "What happened this month?" | The milestones that moved, each with a signed working-day delta, worst first | Critical path joined and left; change counts by category; health delta | Become a dashboard of equal-weight tiles. Milestones lead. |
| **Changes** | "Show me exactly what changed." | Grid and Gantt, filtered to changed activities, with the previous dates as ghost bars | Filters by change type; the hidden-row count | Lose the planner's place when a filter or sort changes |
| **Slip trace** | "Why did this milestone move?" | A ranked list: the few activities that caused most of the slip, each with its share in days | The driving chain as a small network; own slip versus inherited slip | Present the chain as the answer. The ranked causes are the answer; the chain is the evidence. |
| **Health** | "Is this schedule getting better or worse?" | The checks that changed status or got worse since the last update, first | All 14 checks with before and after; click through to offenders | Reduce everything to one score with no way in |
| **Finish update** | "What do I tell the client?" | An editable narrative where each claim carries its activity chips | Export; what was edited by hand versus generated | Let a claim exist without evidence |
| **Agent panel** | "Can I just ask?" | The answer, short, with chips and a table where needed | Steps collapsed by default; proposals as cards | Look more confident than the data. "The data does not show this" is a designed state, not an error. |

For each screen, before building it: a low-fidelity layout showing hierarchy only (boxes and labels), reviewed against the question above. Keep these in `docs/design/flows/`.

The screens form one flow: import, summary, pick a milestone, trace, check health, finish update. The case study and the demo recording follow one planner through that flow with the `rail-350k` fixture.

---

## Hard design problems

These are the decisions most worth showing. For each one, explore **at least three options**, pick one, and write up why. Options can be rough sketches, Figma frames or throwaway stories; what matters is that they are kept.

1. **Showing slip in a grid cell.** Sign, magnitude and direction at 24px row height, readable when scanning hundreds of rows. (Options to try: number only, number plus bar, number plus colour step, arrow glyphs.)
2. **Two schedules on one Gantt.** Ghost bars for the previous update without doubling the visual noise, including when the bar barely moved and when it moved off screen.
3. **The trace view.** Ranked list, chain, waterfall of contributions, or a combination, and how own slip is separated from inherited slip.
4. **The proposed edit card.** Enough before and after to approve with confidence, including the knock-on effect on key milestones before approval, without becoming a form.
5. **Agent steps.** How much reasoning to show by default, and how a planner tells a grounded answer from an unverified one.
6. **Density.** What changes between compact and comfortable, and what never changes.
7. **Scale honesty.** How a planner knows they are looking at 400 of 350,000 rows, and what the scrollbar means at that size.
8. **Import warnings.** Reporting 3,000 warnings of six kinds without either alarming or burying.

Each write-up lives in `docs/design/explorations/<nn>-<name>/README.md` with this shape:

```
Problem        one paragraph, with the constraint that makes it hard
Options        each with an image and one line on what it does well and badly
Decision       which one, and the reason in two or three sentences
What changed   anything learned later that revised it (research, usage, perf)
```

Keep rejected options. They are the evidence of judgement.

---

## Research into design

Research notes go in `docs/research/`. A finding only counts when it is tied to a change:

- Each planner conversation produces a short note: who (role and sector only, no names or employers without permission), what they do in an update review today, what is slow or risky, and direct quotes.
- `docs/research/findings.md` lists findings, each linked to the design change it caused, or marked "no change" with a reason.
- At least one **usability session on the working build** in phase 3: give a planner the `rail-350k` pair and the task "find out why the main milestone slipped and what you would tell the client". Record where they hesitate. Before-and-after screenshots of anything changed as a result go in the case study.
- If no planner is available in time, say so plainly in the case study and use the next best thing (published planner workflows, forum threads, P6 training material), labelled as secondary research. Do not present assumptions as findings.

---

## Storybook as the design system's public face

Storybook is deployed publicly with the app and linked from the README and the app footer. Beyond component stories, it has written pages (MDX):

- **Principles:** the design goals above, each with one example from the product
- **Identity:** type, colour and shape, with the reasoning
- **Slip colour scale:** the diverging scale, where each step is used, and the colour-blind simulations
- **Density:** compact and comfortable side by side, and the rules for each
- **States:** the four panel states plus streaming, with the copy rules
- **Content:** vocabulary, tone, number and date formats, units
- **Do and do not** per component: a correct and an incorrect example with one line each. These same examples feed `packages/ui/AGENTS.md`, so the guidance for people and for agents cannot drift apart.
- **Canvas primitives:** each Gantt painter drawn in isolation at device pixel ratio 1 and 2

---

## Design artefacts to produce

| Artefact | Where | When |
|---|---|---|
| Identity decision record (D16) and chosen colour values | `docs/decisions/` | Phase 1 |
| Low-fidelity flow for the six screens | `docs/design/flows/` | Phase 1, before any screen is built |
| Tokens and Storybook, deployed | `packages/ui` | Phase 1 |
| Explorations 1, 2, 6, 7, 8 | `docs/design/explorations/` | Phases 1 and 2, before building the thing each one concerns |
| Explorations 3, 4, 5 | `docs/design/explorations/` | Phases 3 and 4, same rule |
| Research notes and findings | `docs/research/` | Ongoing from phase 1 |
| Usability session and resulting changes | `docs/research/`, case study | Phase 3 |
| Storybook written pages | `packages/ui` | Phase 4 |
| Case study | `docs/case-study.md` (also published) | Phase 4 |
| Demo recording, under three minutes | linked from the README | Phase 4 |

An exploration is written **before** its feature is built. Writing one afterwards to justify what was built defeats the purpose and should be recorded honestly in the journal if it happens.

---

## Case study outline

One page a reviewer can read in five minutes, with links for depth.

1. The problem, in a planner's words
2. What Slip does, as one flow with five screenshots
3. Three design decisions, each with the options considered (from the explorations)
4. What research changed
5. Scale: the published numbers and how they were measured
6. Designing for coding agents: the with-and-without experiment and its results
7. What Usman designed and decided, and what agents generated (from the journal)
8. What is not done, and what would come next

---

## Design review checklist (every new or changed screen)

- The screen's primary question is answered by the most prominent element
- It works at 1280px wide in compact density with the longest realistic content (long activity names, six-digit counts, negative values)
- All four states exist and the empty and error states offer a next action
- Nothing relies on colour alone
- Every number is tabular, right aligned and has a unit
- It can be used with the keyboard only, and focus is always visible
- Copy follows the content rules: plain British English, sentence case, planner vocabulary
- If it involved a decision listed under hard design problems, the exploration exists and is linked from the pull request
