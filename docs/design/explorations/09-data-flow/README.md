# Exploration 09: where your data goes

Status: **decided on 15 November 2026: option B, opened from the footer.**

## Problem

Planlab's customers ask where their data goes, and Slip has to answer exactly. The product spec asks for a "Where your data goes" panel, drawn as a simple diagram, that always matches what the code does; security.md asks for a one-time notice before the first live question that links to it. The hard part is that the honest answer depends on the assistant's mode. In scripted mode, the only mode on the public site, nothing about the schedule leaves the browser. In live mode, the question and the specific rows the assistant asks for go through Slip's server to Anthropic. The panel must say both without overclaiming ("the schedule never leaves the browser" is not allowed without the live-mode qualification), and must be believable to an IT or information-security reviewer, not only reassuring to a planner.

## Options

All three are on one page, with a switch between scripted mode, live mode, and live mode after three questions: [options.html](options.html). Run the `design` preview and open `/explorations/09-data-flow/options.html`. The facts in all three come from [docs/data-flow.md](../../../data-flow.md).

| Option | Does well | Does badly |
| --- | --- | --- |
| **A. A diagram: three places, each piece of data drawn where it goes** | Is the diagram the spec asks for; the answer is visible before it is read, and in scripted mode the empty right side says it all | Looks like a promise without saying what holds it; needs a key; harder to keep exact as rows are added |
| **B. The table from the security spec, with how it is held to** | The same table as security.md and docs/data-flow.md, so a test can keep all three equal; says what enforces it | Not a diagram; dense for a planner who only wants to know if loading the file is safe |
| **C. What stays, what leaves, and what was actually sent this session** | Shows real behaviour, not only policy: every live question and the codes of the rows it sent | More to build and keep right; empty on the public site, which is scripted only; keeping the list in the tab is itself a choice |

Drawn once, because it is the same whichever option is chosen: the notice before the first live question, with links to the panel and back to the scripted assistant. And two places the panel could open from, because the spec says "the top bar" and Slip has no shared top bar: a link in every screen's header, or in the footer that every screen already has.

Things the mock made visible:

- In scripted mode all three options collapse to "nothing leaves", which is true and is all the public site can show. The choice matters only once live mode exists.
- The host (Vercel) sees requests and IP addresses like any website. Only A says so in the drawing; the others would need the same line.
- B's "kept the same by a test" does not exist yet. Choosing B means writing it.
- C's session list would be a new record of questions. Keeping it in the tab only, not in IndexedDB, avoids storing questions, but means it is gone on reload.

## Decision

**Option B, the table with how it is held to, opened from a link in the footer.** Chosen by Usman on 15 November 2026 ("B, footer link"), accepting Claude's recommendation. The reasons below are Claude's, which he accepted.

- B is the most exact for an IT or information-security reviewer, and the only option a test can hold to the written statements in `docs/data-flow.md` and security.md.
- A was rejected because a drawing does not say what makes it true. C was rejected for now because it is empty on the public site; it could be added under B once live mode exists.
- The footer is on every screen already, and Slip has no shared top bar.

## What changed

- 15 November 2026: built. The table always shows the live-mode rows, marked "Live mode is not on this site" in scripted mode, so the panel prints exactly the rows `docs/data-flow.md` and security.md print; a test holds the three together.
