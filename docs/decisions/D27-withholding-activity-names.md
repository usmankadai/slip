# D27: Withholding activity names from the assistant

Date: 17 November 2026. Status: accepted.

## Context

The security spec asks for a setting, "Send activity names to the agent", on by default. When it is off, tool results give activities by code only and the model is told names are withheld. Usman chose, on 17 November 2026, to put the switch in the assistant panel, under the question box, rather than in "Where your data goes" or in both. He accepted the recommendation; the reasons below are the agent's.

## Options

- **Where names are removed.** In the browser when each tool result is built, or on the server before the call to Anthropic. The browser is the only place that knows which fields are schedule names, and removing them there means they never reach Slip's server either.
- **How the model is told.** A line in the system prompt, sent as a flag to the server; or a note in each tool result that would have carried names. A flag changes the server's request contract and splits the prompt cache in two. A note travels with the data it describes and needs no server change.
- **What happens to earlier results.** Every question resends the conversation so far, including earlier tool results. If names were on for an earlier question and are then turned off, those rows would be sent again with their names.

## Decision

- `runTool(engine, name, input, { names: false })` leaves activity names out of every result: search results, an activity and its relationships, the trace and its causes, the milestones in the change summary, and a proposal. The key is left out, not emptied. Each such result carries `names_withheld`, a sentence telling the model to refer to activities by code and not guess their names. Health check names stay: they are DCMA's words, not schedule content. WBS codes stay, as codes.
- The switch shows in live mode only. Scripted answers never leave the browser and are written from the names, so they always have them.
- Changing the setting starts a new conversation with the model: earlier results are not resent. The answers stay on screen, and the note under the switch says so.
- The choice is remembered in this browser (`localStorage`). If storage is blocked it lasts for the page.
- The notice before the first live question and the "Where your data goes" table say what is sent with the setting as it is.

## Consequences

- The model can still search by name text: `search_activities` filters on codes and names in the browser and returns codes. What the planner types in a question is sent as typed; mentions write codes, not names.
- Answers with names withheld cite codes only, which are still chips that open the grid.
- Tested against a generated pair: with names off, no activity name from either update appears in any tool's result (`packages/gen/test/agent-tools.test.ts`), and the loop sends none (`apps/web/src/features/agent/agent.test.ts`).
