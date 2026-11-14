# ProposedEditCard

## Contract

- **Use for** a change the assistant proposed to the schedule, for the planner to approve or reject (exploration 04, option B).
- **Do not use for** a change the planner makes directly, or for anything already applied without asking.
- **Props:** the field, the activity, from and to, the assistant's reason, the engine's preview of the effect (null while it is worked out), the state, and the three actions.
- **Rules:**
  - Nothing changes until Approve. Approve stays disabled until the effect is known: nobody approves blind.
  - Every milestone the change moves is listed with the slip cell, so a change that helps one and hurts another is visible.
  - A change that makes the project finish later says so in words above the table, not only in the numbers.
  - After a decision the card stays, saying what happened. An approved change offers Undo.
  - Approve and Reject are both written to the audit log by the caller.
