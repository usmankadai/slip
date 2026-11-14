# AgentSteps

## Contract

- **Use for** the assistant's working above each answer: how long it took, how many tools it called, and on request what each call returned.
- **Do not use for** progress of a file read (use `ProgressBar`), or for the answer itself.
- **Props:** `steps` (each a tool, its input and result in a few words, and whether it failed), `seconds`, `working`.
- **Rules:**
  - Folded by default (exploration 05, option A). The answer leads; the working is one line.
  - A failed tool call is said in words ("failed: ..."), not only by weight.
  - Inputs and results are short summaries, never raw tool output: tool output contains schedule text and is long.
  - Nothing animates.
