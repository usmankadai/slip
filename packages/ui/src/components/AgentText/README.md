# AgentText

## Contract

- **Use for** the text of an assistant's answer.
- **Do not use for** generated narrative text (that is the narrative's own editor) or anything the planner wrote.
- **Props:** `parts`, the answer split by `splitCitations` from `@slip/agent`; `onOpen`, which opens a cited activity.
- **Rules:**
  - Only codes that appeared in this answer's tool results are chips. Anything else is text with the word "unverified" beside it, where it was written.
  - Text is rendered as text, never as HTML or Markdown: an answer can contain anything the schedule file contained.
