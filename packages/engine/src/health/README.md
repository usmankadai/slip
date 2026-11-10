# DCMA 14-point checks: counting rules

These are the rules `health.ts` follows. Published descriptions of the DCMA assessment differ in small ways, and tools differ again, so every choice is written down here. Change this file and the code together.

## What is counted

- **Left out of everything:** level of effort and WBS summary activities.
- **Unfinished activity:** one with no actual finish. Milestones are included unless a check says otherwise.
- **Relationship:** one whose successor is unfinished and whose two ends are both counted activities.
- **Float and early dates:** recalculated values if CPM has been run for the update, otherwise the values stored in the file.
- **Working days:** minutes divided by the hours per day of the activity's own calendar.
- **Baseline finish:** the planned ("target") finish date in the file.

## The checks

| #   | Check                      | Counted                                                                                                                                                                                                                                                 | Measured against                                             | Passes when                    |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------ |
| 1   | Missing logic              | Unfinished activities with no predecessor or no successor                                                                                                                                                                                               | Unfinished activities                                        | 5% or less                     |
| 2   | Leads                      | Relationships with a negative lag                                                                                                                                                                                                                       | Relationships                                                | None                           |
| 3   | Lags                       | Relationships with a positive lag                                                                                                                                                                                                                       | Relationships                                                | 5% or less                     |
| 4   | Relationship types         | Relationships that are not finish to start                                                                                                                                                                                                              | Relationships                                                | Finish to start is 90% or more |
| 5   | Hard constraints           | Unfinished activities with start on, finish on, mandatory start or mandatory finish                                                                                                                                                                     | Unfinished activities                                        | 5% or less                     |
| 6   | High float                 | Unfinished activities with total float over 44 working days                                                                                                                                                                                             | Unfinished activities                                        | 5% or less                     |
| 7   | Negative float             | Unfinished activities with total float below zero                                                                                                                                                                                                       | Unfinished activities                                        | None                           |
| 8   | High duration              | Unfinished activities, not milestones, with original duration over 44 working days                                                                                                                                                                      | Unfinished activities that are not milestones                | 5% or less                     |
| 9   | Invalid dates              | An actual start or finish after the data date; or an unstarted activity with an early start before it; or an unfinished activity with an early finish before it                                                                                         | All counted activities                                       | None                           |
| 10  | Resources                  | Not assessed: resource assignments are not read yet                                                                                                                                                                                                     |                                                              | Reported only                  |
| 11  | Missed tasks               | Activities with a baseline finish on or before the data date that are unfinished, or finished later than the baseline                                                                                                                                   | Activities with a baseline finish on or before the data date | 5% or less                     |
| 12  | Critical path test         | Unfinished activities with total float of zero or less                                                                                                                                                                                                  | Unfinished activities                                        | Reported only                  |
| 13  | Critical path length index | (length + least float) / length. Length is working days from the data date to the latest early finish of unfinished work, on the project's default calendar. Least float is the lowest total float of any unfinished activity, in its own working days. |                                                              | 0.95 or more                   |
| 14  | Baseline execution index   | Finished activities / activities with a baseline finish on or before the data date                                                                                                                                                                      |                                                              | 0.95 or more                   |

## Known departures

- **Check 1** counts the first and last activities of the schedule like any other. A schedule's start and finish milestones will normally appear here; DCMA allows for them, and the 5% threshold absorbs them on any real schedule.
- **Check 4** treats a relationship of unknown type as not finish to start.
- **Check 9** needs a data date. Without one it is not assessed.
- **Check 12** is not the DCMA test, which delays an activity by a large amount and checks that the finish moves by the same amount. It reports how much of the schedule is critical.
- **Check 13** uses the lowest float in the schedule where DCMA uses the float of the completion milestone. They agree when the completion milestone is the most critical point, which is the usual case.
- **Check 14** counts every finished activity, including ones finished ahead of their baseline, as DCMA does. It can therefore exceed 1.

## Offenders

Each check returns the activities to look at. For relationship checks (2, 3, 4) these are the successors of the relationships counted. Check 14 returns the same activities as check 11: the ones that were due and are not done on time.
