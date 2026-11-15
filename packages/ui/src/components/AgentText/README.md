# AgentText

## Contract

- **Use for** the text of an assistant's answer.
- **Do not use for** generated narrative text (that is the narrative's own editor) or anything the planner wrote.
- **Props:** `blocks`, the answer as paragraphs, lists and tables from `answerBlocks` in `@slip/agent`, or `parts` for a single paragraph from `splitCitations`; `onOpen`, which opens a cited activity.
- **Rules:**
  - Only codes that appeared in this answer's tool results are chips. Anything else is text with the word "unverified" beside it, where it was written.
  - Text is rendered as text, never as HTML: an answer can contain anything the schedule file contained. Only an allow-list of shapes is drawn: paragraphs, bulleted and numbered lists, tables and bold. Links, images, headings beyond bold and anything else stay as the characters written.
