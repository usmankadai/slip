# D25: The narrative's PDF, written without a library

Date: 15 November 2026. Status: accepted.

## Context

The product spec asks for the narrative to export as Markdown and PDF. The security spec asks that exports escape their content. The performance spec asks that export code is loaded on demand. The narrative is a few pages of text: a title, headings, paragraphs and short notes.

## Options

- **The browser's print dialog** with a print stylesheet. No code to speak of, and the text is selectable. But the planner gets a dialog, not a file, and the result depends on the browser and its print settings.
- **A PDF library** (pdf-lib, jsPDF). Complete, but a new dependency of 100 KB or more for a few pages of text, with fonts to embed for full Unicode.
- **A small writer of our own**, using the three Helvetica fonts every PDF reader carries, so nothing is embedded.

## Decision

A small writer of our own: `apps/web/src/features/narrative/pdf.ts`, A4, text only. Lines are wrapped with Helvetica's published character widths, and long text runs onto numbered pages. The code is a separate chunk loaded on the first PDF export.

Every piece of text goes into the file as an escaped PDF string: backslash and brackets are escaped, and anything outside printable ASCII is written as an octal code. Nothing in a schedule name or the planner's words can close the string or add an instruction to the page. A test feeds it text built to do exactly that.

## Consequences

- The fonts use the Windows Latin character set (WinAnsiEncoding). Accented Latin letters and typographic quotes and dashes are fine. Anything else, such as Polish, Greek or Chinese text, cannot be shown: it is written as a question mark, and the planner is told how many characters were replaced and that the Markdown export keeps them all. Embedding a Unicode font would fix this, at the cost of a font file in the chunk.
- No hyphenation, kerning or justification. Bold text is measured with a safety margin, so a bold line can wrap a little early.
- 11 unit tests, and an export through the app checked by rendering the file in macOS's own PDF renderer.
