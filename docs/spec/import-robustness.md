# Real-world files and import robustness

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


Synthetic files are clean. Real exports are not. The import must never crash, hang or silently produce wrong numbers. Every case below has a fixture in `fixtures/malformed/` or `fixtures/real/` and a test.

| Situation | Behaviour |
|---|---|
| Not an XER (no `ERMHDR`), or empty | Reject with a clear error naming what was expected |
| Truncated file (no `%E`) | Import what parsed, flag as incomplete in the import report, require a confirmation to continue |
| Multiple projects in one file | Show a project picker; relationships to activities in unselected projects are counted and reported as external |
| A and B are different projects (name differs and fewer than 20% of task codes match) | Warn before continuing: "These look like different schedules" |
| A and B loaded in the wrong order (A's data date is later) | Offer to swap them |
| The same file loaded twice (same hash) | Say so; the diff would be empty |
| Duplicate `task_code` within a project | Keep all, match the first, list the duplicates as warnings, exclude the others from matching |
| Relationship pointing at a missing task | Drop it and count it in the report |
| Activity with a missing calendar or WBS | Use the project default calendar or a synthetic "Unassigned" WBS node, with a warning |
| Logic loops | Report the activities in each loop; CPM runs with loop relationships removed and says so |
| Rows with fewer or more fields than `%F` | Pad or truncate, count, warn |
| Unknown tables, fields and enum values | Ignore tables and fields; map unknown enum values to an `Unknown` member and warn |
| Unusual encodings, a byte order mark, CRLF or LF, tabs or newlines inside quoted text | Handled by the parser, with tests |
| Zero activities, or zero relationships | Valid; views show their empty states |
| Non-retained-logic scheduling options | Import with a persistent notice ([XER format](xer-format.md)) |
| Very large file | Streams without loading the whole file into memory; the cap in [security and privacy](security.md) applies |

The **import report** lists every warning with counts and up to 20 examples each, can be exported, and is written to the audit log. Warnings never block; only a file that cannot be read at all is an error.

Add a parser fuzz test: random mutations of the 1K fixture (deleted bytes, swapped lines, truncation) must end in a result or a typed error within a time limit, never an uncaught exception or a hang.

## What the import screen does today

Built in `apps/web/src/features/import`. Checked by hand against a sample pair, a truncated file, a file that is not an XER, an empty file, the same file twice and a pair in the wrong order.

| Situation in the table above | State |
|---|---|
| Not an XER, or empty | Done. An empty file and a file over the size cap are rejected before any byte is read |
| Truncated file | Done. Compare updates waits until the planner chooses to use the file. The choice is not logged yet: there is no audit log |
| Multiple projects | Done, with one gap: the picker shows each project's name and data date but not its activity count, which the parser does not report per project. A file is cached once per project read from it |
| Different projects, wrong order, same file twice | Done. The 20% test counts activities of update B whose code is also in update A. Same file twice is the one case that disables Compare updates |
| Same data date in both | Added: not in the table above. Has its own wording and does not block |
| Duplicate codes, missing tasks, missing calendar or WBS, field counts, unknown values | Reported by the parser and shown in the import report, grouped (exploration 08) |
| Logic loops | Not in the import report. They are found when dates are calculated |
| Non-retained-logic scheduling options | Not done. The `SCHEDOPTIONS` field names have not been confirmed against a real export |
| Export of the report, and writing it to the audit log | Not done |
| Fixtures in `fixtures/malformed/` and the fuzz test | Not done. The folder is empty |

