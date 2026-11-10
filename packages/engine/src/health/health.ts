/**
 * The DCMA 14-point schedule assessment, run on one update.
 * The counting rules are written out in README.md beside this file; keep
 * the two in step.
 */
import { ConstraintType, NONE, RelType, TaskType, type ScheduleData } from '@slip/xer';
import { clockPicker } from '../cpm.ts';
import type { DiffDates } from '../diff.ts';
import { workBetween, type WorkClock } from '../worktime.ts';

export interface HealthCheck {
  /** 1 to 14, the DCMA numbering. */
  id: number;
  name: string;
  /** The measured figure, or null when it cannot be assessed. */
  value: number | null;
  unit: 'percent' | 'count' | 'ratio';
  /** The DCMA threshold, or null for checks that are reported only. */
  threshold: number | null;
  /** Whether the value must stay at or below the threshold, or at or above it. */
  limit: 'max' | 'min' | null;
  /** null when the check is reported only or cannot be assessed. */
  pass: boolean | null;
  /** How many activities (or relationships) are counted against the check. */
  count: number;
  /** What the count is measured against. */
  population: number;
  /** Activities to look at, in index order. For relationship checks, the successor of each one. */
  offenders: Int32Array;
  /** Why a check could not be assessed, or how to read it. */
  note?: string;
}

const HIGH_DAYS = 44;
const HARD = new Set<number>([
  ConstraintType.StartOn,
  ConstraintType.FinishOn,
  ConstraintType.MandatoryStart,
  ConstraintType.MandatoryFinish,
]);

function percent(count: number, population: number): number | null {
  return population === 0 ? null : (count / population) * 100;
}

export function runHealth(
  data: ScheduleData,
  clocks: WorkClock[],
  dates: DiffDates,
): HealthCheck[] {
  const n = data.n;
  const clockOf = clockPicker(data, clocks);
  const dataDate = data.meta.dataDate;
  const { type, actualStart, actualFinish } = data;

  /** Level of effort and WBS summary activities are left out of every check. */
  const counted = (i: number) =>
    type[i] !== TaskType.LevelOfEffort && type[i] !== TaskType.WbsSummary;
  const incomplete = (i: number) => counted(i) && actualFinish[i] === NONE;
  const milestone = (i: number) =>
    type[i] === TaskType.StartMilestone || type[i] === TaskType.FinishMilestone;
  const dayMinutes = (i: number) => clockOf(i).calendar.dayMinutes || 480;

  const lists: number[][] = Array.from({ length: 15 }, () => []);
  /** 1 once an activity is listed under check 9, so it is listed once. */
  const invalid = new Uint8Array(n);
  let incompleteCount = 0;
  let incompleteWork = 0;
  let due = 0;
  let completed = 0;
  let projectFinish = -Infinity;
  let leastFloatDays = Infinity;

  for (let i = 0; i < n; i++) {
    if (!counted(i)) continue;
    if (actualFinish[i] !== NONE) completed++;

    // 9b and 11 look at finished work too.
    if (dataDate !== NONE) {
      if (
        (actualStart[i] !== NONE && actualStart[i]! > dataDate) ||
        (actualFinish[i] !== NONE && actualFinish[i]! > dataDate)
      ) {
        lists[9]!.push(i);
        invalid[i] = 1;
      }
      const baseline = data.targetFinish[i]!;
      if (baseline !== NONE && baseline <= dataDate) {
        due++;
        if (actualFinish[i] === NONE || actualFinish[i]! > baseline) lists[11]!.push(i);
      }
    }
    if (actualFinish[i] !== NONE) continue;

    incompleteCount++;
    if (!milestone(i)) incompleteWork++;

    if (
      data.predOffsets[i + 1] === data.predOffsets[i] ||
      data.succOffsets[i + 1] === data.succOffsets[i]
    ) {
      lists[1]!.push(i);
    }
    if (HARD.has(data.constraintType[i]!)) lists[5]!.push(i);

    const float = dates.totalFloat[i]!;
    if (float !== NONE) {
      const days = float / dayMinutes(i);
      if (days > HIGH_DAYS) lists[6]!.push(i);
      if (float < 0) lists[7]!.push(i);
      if (float <= 0) lists[12]!.push(i);
      if (days < leastFloatDays) leastFloatDays = days;
    }
    const duration = data.originalDurationMin[i]!;
    if (!milestone(i) && duration !== NONE && duration / dayMinutes(i) > HIGH_DAYS)
      lists[8]!.push(i);

    const start = dates.earlyStart[i]!;
    const finish = dates.earlyFinish[i]!;
    if (finish !== NONE && finish > projectFinish) projectFinish = finish;
    if (dataDate !== NONE && !invalid[i]) {
      const startInPast = actualStart[i] === NONE && start !== NONE && start < dataDate;
      const finishInPast = finish !== NONE && finish < dataDate;
      if (startInPast || finishInPast) lists[9]!.push(i);
    }
  }

  // Relationship checks: every relationship into an activity that is not finished.
  let relationships = 0;
  let finishToStart = 0;
  let leads = 0;
  let lags = 0;
  for (let i = 0; i < n; i++) {
    if (!incomplete(i)) continue;
    let lead = false;
    let lag = false;
    let other = false;
    for (let k = data.predOffsets[i]!; k < data.predOffsets[i + 1]!; k++) {
      if (!counted(data.predTargets[k]!)) continue;
      relationships++;
      if (data.predLagMin[k]! < 0) {
        leads++;
        lead = true;
      } else if (data.predLagMin[k]! > 0) {
        lags++;
        lag = true;
      }
      if (data.predType[k] === RelType.FS) finishToStart++;
      else other = true;
    }
    if (lead) lists[2]!.push(i);
    if (lag) lists[3]!.push(i);
    if (other) lists[4]!.push(i);
  }

  const offenders = (id: number) => Int32Array.from(lists[id]!);
  const share = (id: number, name: string, population: number, threshold: number): HealthCheck => {
    const value = percent(lists[id]!.length, population);
    return {
      id,
      name,
      value,
      unit: 'percent',
      threshold,
      limit: 'max',
      pass: value === null ? null : value <= threshold,
      count: lists[id]!.length,
      population,
      offenders: offenders(id),
      ...(value === null ? { note: 'There are no unfinished activities to assess.' } : {}),
    };
  };
  const none = (id: number, name: string, count: number, population: number): HealthCheck => ({
    id,
    name,
    value: count,
    unit: 'count',
    threshold: 0,
    limit: 'max',
    pass: count === 0,
    count,
    population,
    offenders: offenders(id),
  });

  const fsValue = percent(finishToStart, relationships);

  // 13: critical path length index, measured in working days on the project's default calendar.
  let cpli: number | null = null;
  if (dataDate !== NONE && projectFinish !== -Infinity && leastFloatDays !== Infinity) {
    const usual =
      clocks[data.calendars.defaultIndex >= 0 ? data.calendars.defaultIndex : clocks.length - 1]!;
    const length = workBetween(usual, dataDate, projectFinish) / (usual.calendar.dayMinutes || 480);
    if (length > 0) cpli = (length + leastFloatDays) / length;
  }
  const bei = dataDate === NONE || due === 0 ? null : completed / due;
  const noDataDate =
    dataDate === NONE ? { note: 'The file has no data date, so this cannot be assessed.' } : {};

  return [
    share(1, 'Missing logic', incompleteCount, 5),
    none(2, 'Leads', leads, relationships),
    {
      id: 3,
      name: 'Lags',
      value: percent(lags, relationships),
      unit: 'percent',
      threshold: 5,
      limit: 'max',
      pass: relationships === 0 ? null : (lags / relationships) * 100 <= 5,
      count: lags,
      population: relationships,
      offenders: offenders(3),
    },
    {
      id: 4,
      name: 'Relationship types',
      value: fsValue,
      unit: 'percent',
      threshold: 90,
      limit: 'min',
      pass: fsValue === null ? null : fsValue >= 90,
      count: relationships - finishToStart,
      population: relationships,
      offenders: offenders(4),
      note: 'The value is the share of relationships that are finish to start. The count is the rest.',
    },
    share(5, 'Hard constraints', incompleteCount, 5),
    share(6, 'High float', incompleteCount, 5),
    none(7, 'Negative float', lists[7]!.length, incompleteCount),
    share(8, 'High duration', incompleteWork, 5),
    {
      ...none(9, 'Invalid dates', lists[9]!.length, n),
      ...(dataDate === NONE ? { value: null, pass: null } : {}),
      ...noDataDate,
    },
    {
      id: 10,
      name: 'Resources',
      value: null,
      unit: 'count',
      threshold: null,
      limit: null,
      pass: null,
      count: 0,
      population: incompleteWork,
      offenders: new Int32Array(0),
      note: 'Resource assignments are not read from the file yet, so this is not assessed.',
    },
    {
      ...share(11, 'Missed tasks', due, 5),
      ...(due === 0 ? { note: 'No activity was due by the data date.' } : {}),
      ...noDataDate,
    },
    {
      id: 12,
      name: 'Critical path test',
      value: lists[12]!.length,
      unit: 'count',
      threshold: null,
      limit: null,
      pass: null,
      count: lists[12]!.length,
      population: incompleteCount,
      offenders: offenders(12),
      note: 'Reported only: the number of unfinished activities with total float of zero or less. The full DCMA test (delay an activity and see the finish move by the same amount) is not run.',
    },
    {
      id: 13,
      name: 'Critical path length index',
      value: cpli,
      unit: 'ratio',
      threshold: 0.95,
      limit: 'min',
      pass: cpli === null ? null : cpli >= 0.95,
      count: 0,
      population: incompleteCount,
      offenders: new Int32Array(0),
      ...(cpli === null ? { note: 'Needs a data date, unfinished work and float values.' } : {}),
    },
    {
      id: 14,
      name: 'Baseline execution index',
      value: bei,
      unit: 'ratio',
      threshold: 0.95,
      limit: 'min',
      pass: bei === null ? null : bei >= 0.95,
      count: completed,
      population: due,
      offenders: offenders(11),
      ...(bei === null
        ? { note: 'No activity was due by the data date, or the file has no data date.' }
        : {}),
    },
  ];
}
