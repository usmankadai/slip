# Product scope

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


## The core workflow
1. **Import** two XER files (previous update and current update), or pick a bundled synthetic pair.
2. **Update summary** (landing screen after import):
   - Key milestones that moved, with the delta in working days
   - Critical path before and after: activities that joined or left it
   - Counts of changed activities by category (dates, durations, logic, constraints, progress, added, removed)
   - Health score delta (DCMA checks, see [workers and engine](engine.md))
3. **Changes view**: a windowed grid plus Gantt, filtered to changed activities by default. Baseline ghost bars show the previous update's dates.
4. **Slip trace**: pick a milestone that moved and walk back along the driving path to the activities that caused the slip. Show it as a ranked list (largest contributors first) and a small focused network view.
5. **Health comparison**: DCMA 14-point checks run on both updates, shown as a delta ("12 new hard constraints this update"). Every failed check clicks through to the activities causing it.
6. **Finish update**: generates a written change narrative for the monthly report. Every claim links to activity IDs. The planner can edit it before export (Markdown and PDF).

## Agent panel
A side panel in the style of a copilot:
- Streams its reasoning steps ("Worked for 12s, 4 steps") with collapsible step detail.
- Renders inline blocks: text, table, chart, activity chips, proposed edit.
- `#` opens an activity / WBS / code mention picker in the input.
- **Never edits the schedule silently.** Edits arrive as a proposed diff card (before / after per field). Approving it applies the change, reruns CPM, and writes an audit log entry. Rejecting it also writes an entry.
- Answers must cite activity IDs. If the data cannot answer a question, the agent says so.
- **Two modes.** *Scripted* (the public default): canned, clearly labelled answers over the bundled fixtures, costing nothing, so the public link always has a working agent panel. *Live*: calls the Anthropic API through `apps/api`. See [agent API](agent-api.md).

## Audit log
Every import, edit, approval, rejection and export is logged with a timestamp, actor (user or agent) and payload. It can be viewed as a timeline panel. It survives a page reload ([persistence](persistence.md)).

## Undo
Applied edits can be reverted from the audit timeline. A revert is itself an edit: it reruns CPM and writes an audit entry. There is no silent history rewrite.

## Data flow view
A "Where your data goes" panel, reachable from the top bar, shows as a simple diagram exactly what stays in the browser and what is sent to the server and to Anthropic ([security and privacy](security.md)). It must always match the real behaviour; update it in the same change as any change to data flow.

## Out of scope (do not build unless asked)
- Authentication, multi-tenant accounts, real P6 / Oracle Primavera Cloud API sync
- Multi-user collaboration, presence or live sync (so no WebSockets; see D8)
- Resource levelling
- Monte Carlo risk analysis
- Writing XER back out (export is the narrative and CSV only, for now)
- Mobile layouts (desktop first, minimum width 1280px; must not break below that, but no optimised mobile design)
