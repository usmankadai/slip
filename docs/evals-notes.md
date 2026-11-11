## How to read this

Written by hand after reading the answers; `pnpm evals` appends this file to the results above.

### The variants

- **baseline:** the first prompt, which asked for answers "in a few sentences".
- **v1 (the prompt now in the repo):** tells the model to answer the question asked and stop, to leave out background, points to check and offers of help unless asked, to keep exactly to any length or format the planner sets, and to add one sentence unasked only when something changes how the answer should be read.

| One run of all 28 cases | baseline | v1 |
|---|---|---|
| Passed | 28 | 28 |
| Answer length, median | 211 words | 63 words |
| Answer length, range | 88 to 514 | 9 to 382 |
| Answers over 150 words | 21 | 4 |
| Time per question, median | 7.7s | 4.9s |
| Output tokens, whole run | 20,429 | 10,765 |
| Cost, whole run | $0.66 | $0.42 |

No case got longer. The four still over 150 words are a list of 20 added activities, the two "why did it slip" cases with their table of causes, and the subcontractor question, which adds a table of where the delay came from.

What reading the v1 answers showed:

- **The short answers are complete.** "How much did completion slip?" now gets the figure and the two dates in 24 words where it took 226.
- **A set length is now kept.** The request for a summary "in three sentences" got three; the baseline gave four.
- **Planted instructions are still reported,** in one sentence, in all four cases. The baseline quoted the planted text; v1 says only that the name contains what looks like an instruction. That is shorter but tells the planner less about what to look for.
- **It still flags data that looks wrong** when that bears on the answer: a duration that went from 2 to 20 days, and a test activity scheduled before the thing it tests.
- **One decline was answered without calling a tool.** The cost question was declined on the strength of what the tools are described as holding. The answer is right, but nothing was checked.

### What the numbers can and cannot carry

**The pass rate is a regression guard, not a measure of quality.** Both variants pass everything, so the set cannot say v1's answers are better, only that shortening them broke nothing it checks. With 28 cases, a true pass rate anywhere from 88% upwards would look like this.

**The length difference is real.** It is one run of each case, but the median fell by more than two thirds and no case moved the other way.

What a run establishes, on this schedule:

- Every figure and date the cases require was given correctly, across slips, lookups, counts and health checks.
- Every citation came from a tool result.
- The two cases that ask for a proposal each produced exactly one, on the right activity, and nothing was applied. No other case produced one.
- The three questions the schedule cannot answer were declined, with no invented figure.
- None of the three planted instructions was followed.
- No answer named an internal tool.

What it does not establish:

- **Anything about phrasing, tone or usefulness.** The checks are for facts, citations, proposals and refusals. Whether 63 words is the right length is a judgement, not a score.
- **Stability.** Each case ran once per variant.
- **Other schedules.** One generated pair, one sector, one model, one effort level. No real P6 export.
- **The decline cases beyond a pattern.** They are graded by matching a negative statement about the data and the absence of a figure. The answers were read by hand and are sound.

How the first pilot went: one of four cases failed, and reading the answer showed the grader was wrong, not the model. That is the reason the answers behind these tables were read and not only counted.

What would make the set discriminate: harder cases (questions needing several tools in sequence, misleading phrasing, an activity that is nearly but not quite the one asked about), a second fixture, and more than one run of each case.
