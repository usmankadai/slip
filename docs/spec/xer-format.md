# XER format notes

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


XER is a tab-delimited text export from Primavera P6.

- First line starts with `ERMHDR`.
- `%T <TABLE>` starts a table, `%F` lists field names, `%R` is a record row, `%E` ends the file.
- Files are often **windows-1252** encoded. Decode with `TextDecoder('windows-1252')` unless the header says otherwise.
- Durations and float are stored in **hours** (`*_hr_cnt`). Convert to working days using the calendar's `day_hr_cnt` (default 8).
- **Dates have no timezone.** They are wall-clock values (`yyyy-mm-dd hh:mm`). Parse them by hand into minutes since the project epoch. Never pass them through `new Date(string)` or any timezone-aware API: a daylight saving change would shift dates by an hour and corrupt the diff. Format them for display the same way, by arithmetic.

Tables we read (ignore the rest, but do not crash on them):

| Table | Fields we use |
|---|---|
| `PROJECT` | `proj_id`, `proj_short_name`, `last_recalc_date` (data date), `plan_start_date` |
| `SCHEDOPTIONS` | `proj_id`, the progress logic setting (retained logic, progress override or actual dates), and the critical definition (float threshold or longest path) |
| `CALENDAR` | `clndr_id`, `clndr_name`, `day_hr_cnt`, `clndr_data` |
| `PROJWBS` | `wbs_id`, `parent_wbs_id`, `wbs_short_name`, `wbs_name`, `seq_num` |
| `TASK` | `task_id`, `task_code`, `task_name`, `wbs_id`, `clndr_id`, `task_type`, `status_code`, `target_drtn_hr_cnt`, `remain_drtn_hr_cnt`, `early_start_date`, `early_end_date`, `late_start_date`, `late_end_date`, `act_start_date`, `act_end_date`, `target_start_date`, `target_end_date`, `total_float_hr_cnt`, `free_float_hr_cnt`, `cstr_type`, `cstr_date`, `cstr_type2`, `cstr_date2`, `driving_path_flag` |
| `TASKPRED` | `task_pred_id`, `task_id`, `pred_task_id`, `pred_type`, `lag_hr_cnt` |
| `ACTVTYPE`, `ACTVCODE`, `TASKACTV` | activity code types, values, assignments |
| `RSRC`, `TASKRSRC` | resource names and assignments (only needed for the DCMA resources check) |

Confirm the exact `SCHEDOPTIONS` field names against a real export in `fixtures/real/` before relying on them, and record them here.

Enumerations:
- `task_type`: `TT_Task`, `TT_Rsrc`, `TT_Mile` (start milestone), `TT_FinMile`, `TT_LOE`, `TT_WBS`
- `status_code`: `TK_NotStart`, `TK_Active`, `TK_Complete`
- `pred_type`: `PR_FS`, `PR_SS`, `PR_FF`, `PR_SF`
- `cstr_type`: `CS_MSO`, `CS_MSOA`, `CS_MSOB`, `CS_MEO`, `CS_MEOA`, `CS_MEOB`, `CS_MANDSTART`, `CS_MANDFIN`, `CS_ALAP`. Hard constraints for DCMA: `CS_MSO`, `CS_MEO`, `CS_MANDSTART`, `CS_MANDFIN`.

**Matching across updates:** match activities by `task_code` within the project, not `task_id` (IDs can change between exports of copies). Match relationships by the `(pred task_code, succ task_code, pred_type)` tuple.

**Calendars:** v1 supports working weekdays and daily hours from `clndr_data` plus listed holiday exceptions. If `clndr_data` cannot be parsed, fall back to Monday to Friday at `day_hr_cnt` hours and record a warning in the import report. Document the simplifications in `docs/decisions/`.

**Scheduling options:** v1 computes with **retained logic** only. If `SCHEDOPTIONS` says the file was scheduled another way, import still succeeds, the import report carries a warning, and the UI shows a persistent notice that Slip's recalculated dates may differ from P6's. The dates stored in the file are always kept and shown as the source of truth until the planner makes an edit.

Messy real files are covered in [import robustness](import-robustness.md).
