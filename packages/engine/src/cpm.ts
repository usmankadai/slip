/**
 * Critical path method on a columnar schedule: a forward pass for early
 * dates, a backward pass for late dates, then float.
 *
 * The scheduling rules are the ones in decision D17 (retained logic, lag on
 * the predecessor's calendar, completed work keeps its actual dates). The
 * synthetic generator has its own, separately written scheduler that
 * follows the same rules; tests require the two to agree exactly.
 *
 * Everything is typed arrays and plain loops. Nothing here allocates per
 * activity, so a million activities is a few passes over flat memory.
 */
import {
  ConstraintType,
  MINUTES_PER_DAY,
  NONE,
  RelType,
  TaskType,
  fallbackWeek,
  type Calendar,
  type ScheduleData,
} from '@slip/xer';
import {
  addWork,
  compileCalendar,
  snapBackward,
  snapForward,
  subtractWork,
  workBetween,
  type WorkClock,
} from './worktime.ts';

export interface CpmResult {
  earlyStart: Int32Array;
  earlyFinish: Int32Array;
  /** NONE for completed activities. */
  lateStart: Int32Array;
  lateFinish: Int32Array;
  /** Finish float in minutes of the activity's own calendar. NONE for completed activities. */
  totalFloat: Int32Array;
  freeFloat: Int32Array;
  /** The latest early finish of any activity. */
  projectFinish: number;
  /** The data date the pass used. Differs from the file's only when the file has none. */
  dataDate: number;
  /** Activities that sit on a logic loop, in index order. Empty for a sound network. */
  loopActivities: Int32Array;
  /** Relationships left out of the calculation to break those loops. */
  ignoredRelationships: number;
}

const SS = RelType.SS;
const FF = RelType.FF;

/**
 * One prepared clock per calendar in the schedule, plus a Monday to Friday
 * fallback as the last entry for activities whose calendar is missing.
 * `spanDays` is how far past the latest date in the file the clocks reach.
 */
export function prepareClocks(data: ScheduleData, spanDays = 365 * 60): WorkClock[] {
  let low = Infinity;
  let high = -Infinity;
  const columns = [
    data.earlyStart,
    data.earlyFinish,
    data.lateStart,
    data.lateFinish,
    data.actualStart,
    data.actualFinish,
    data.constraintDate,
  ];
  for (const column of columns) {
    for (let i = 0; i < column.length; i++) {
      const value = column[i]!;
      if (value === NONE) continue;
      if (value < low) low = value;
      if (value > high) high = value;
    }
  }
  if (data.meta.dataDate !== NONE) {
    low = Math.min(low, data.meta.dataDate);
    high = Math.max(high, data.meta.dataDate);
  }
  if (low === Infinity) {
    low = 0;
    high = 0;
  }
  // Negative float can push late dates well before the earliest date in the file.
  const fromDay = Math.floor(low / MINUTES_PER_DAY) - 365 * 10;
  const toDay = Math.floor(high / MINUTES_PER_DAY) + spanDays;
  const fallback: Calendar = {
    id: -1,
    name: 'Fallback 5 day',
    dayMinutes: 480,
    week: fallbackWeek(480),
    exceptionDays: new Int32Array(0),
    exceptionPeriods: [],
    parsed: false,
  };
  return [...data.calendars.calendars, fallback].map((calendar) => {
    try {
      return compileCalendar(calendar, fromDay, toDay);
    } catch {
      // A calendar with no working time at all cannot schedule anything; use the fallback's hours.
      return compileCalendar({ ...fallback, id: calendar.id, name: calendar.name }, fromDay, toDay);
    }
  });
}

/** Picks the prepared clock for an activity: its own calendar, else the project default, else the fallback. */
export function clockPicker(data: ScheduleData, clocks: WorkClock[]): (i: number) => WorkClock {
  const fallback = clocks.length - 1;
  const usual = data.calendars.defaultIndex >= 0 ? data.calendars.defaultIndex : fallback;
  return (i) => {
    const index = data.calendarIndex[i]!;
    return clocks[index >= 0 && index < fallback ? index : usual]!;
  };
}

export function shift(clock: WorkClock, t: number, lag: number): number {
  return lag > 0 ? addWork(clock, t, lag) : lag < 0 ? subtractWork(clock, t, -lag) : t;
}

/** The earliest valid finish at or after t. */
export function finishOnOrAfter(clock: WorkClock, t: number): number {
  const back = snapBackward(clock, t);
  return back >= t ? back : snapForward(clock, t);
}

/** The latest valid start at or before t. */
function startOnOrBefore(clock: WorkClock, t: number): number {
  const forward = snapForward(clock, t);
  return forward <= t ? forward : snapBackward(clock, t);
}

interface Order {
  /** Activities in an order where every predecessor comes first. */
  order: Int32Array;
  /** 1 for each entry of the predecessor arrays that was dropped to break a loop. */
  ignoredPred: Uint8Array;
  ignoredSucc: Uint8Array;
  loopActivities: Int32Array;
  ignoredRelationships: number;
}

/**
 * Kahn's algorithm. When it stalls, the activities left are on or behind a
 * loop: the lowest-numbered one is released by ignoring its unmet
 * predecessors, and the sort carries on. So a looped file still schedules,
 * and the loop is reported instead of hanging the import.
 */
function topologicalOrder(data: ScheduleData): Order {
  const n = data.n;
  const { predOffsets, predTargets, succOffsets, succTargets } = data;
  const waiting = new Int32Array(n);
  for (let i = 0; i < n; i++) waiting[i] = predOffsets[i + 1]! - predOffsets[i]!;
  const order = new Int32Array(n);
  const placed = new Uint8Array(n);
  const ignoredPred = new Uint8Array(predTargets.length);
  const ignoredSucc = new Uint8Array(succTargets.length);
  const loops: number[] = [];
  let ignoredRelationships = 0;
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (waiting[i] === 0) {
      order[tail++] = i;
      placed[i] = 1;
    }
  }
  let scan = 0;
  while (tail < n || head < tail) {
    while (head < tail) {
      const i = order[head++]!;
      for (let k = succOffsets[i]!; k < succOffsets[i + 1]!; k++) {
        if (ignoredSucc[k]) continue;
        const succ = succTargets[k]!;
        if (--waiting[succ]! === 0 && !placed[succ]) {
          order[tail++] = succ;
          placed[succ] = 1;
        }
      }
    }
    if (tail === n) break;
    // Stalled: release the lowest-numbered activity still waiting.
    while (placed[scan]) scan++;
    const stuck = scan;
    loops.push(stuck);
    for (let k = predOffsets[stuck]!; k < predOffsets[stuck + 1]!; k++) {
      const pred = predTargets[k]!;
      if (placed[pred] || ignoredPred[k]) continue;
      ignoredPred[k] = 1;
      ignoredRelationships++;
      // Mark the matching entry in the successor arrays too, for the backward pass.
      for (let j = succOffsets[pred]!; j < succOffsets[pred + 1]!; j++) {
        if (
          !ignoredSucc[j] &&
          succTargets[j] === stuck &&
          data.succType[j] === data.predType[k] &&
          data.succLagMin[j] === data.predLagMin[k]
        ) {
          ignoredSucc[j] = 1;
          break;
        }
      }
    }
    waiting[stuck] = 0;
    order[tail++] = stuck;
    placed[stuck] = 1;
  }
  return {
    order,
    ignoredPred,
    ignoredSucc,
    loopActivities: Int32Array.from(loops),
    ignoredRelationships,
  };
}

export function runCpm(data: ScheduleData, clocks: WorkClock[] = prepareClocks(data)): CpmResult {
  const n = data.n;
  const { order, ignoredPred, ignoredSucc, loopActivities, ignoredRelationships } =
    topologicalOrder(data);
  const fallbackClock = clocks.length - 1;
  const defaultClock =
    data.calendars.defaultIndex >= 0 ? data.calendars.defaultIndex : fallbackClock;
  const clockOf = (i: number): WorkClock => {
    const index = data.calendarIndex[i]!;
    return clocks[index >= 0 && index < fallbackClock ? index : defaultClock]!;
  };

  const earlyStart = new Int32Array(n).fill(NONE);
  const earlyFinish = new Int32Array(n).fill(NONE);
  const lateStart = new Int32Array(n).fill(NONE);
  const lateFinish = new Int32Array(n).fill(NONE);
  const totalFloat = new Int32Array(n).fill(NONE);
  const freeFloat = new Int32Array(n).fill(NONE);
  const work = new Int32Array(n);
  const complete = new Uint8Array(n);

  let dataDate = data.meta.dataDate;
  if (dataDate === NONE) {
    // No data date in the file: the earliest date anything is planned or done.
    let earliest = Infinity;
    for (const column of [data.earlyStart, data.actualStart]) {
      for (let i = 0; i < n; i++)
        if (column[i] !== NONE && column[i]! < earliest) earliest = column[i]!;
    }
    dataDate = earliest === Infinity ? 0 : earliest;
  }

  const { predOffsets, predTargets, predType, predLagMin } = data;
  const { succOffsets, succTargets, succType, succLagMin } = data;
  const { actualStart, actualFinish, constraintType, constraintDate, type } = data;

  // Forward pass.
  let projectFinish = -Infinity;
  for (let at = 0; at < n; at++) {
    const i = order[at]!;
    if (actualFinish[i] !== NONE) {
      complete[i] = 1;
      earlyFinish[i] = actualFinish[i]!;
      earlyStart[i] = actualStart[i] !== NONE ? actualStart[i]! : actualFinish[i]!;
      if (earlyFinish[i]! > projectFinish) projectFinish = earlyFinish[i]!;
      continue;
    }
    const started = actualStart[i] !== NONE;
    const remaining = data.remainingDurationMin[i]!;
    const original = data.originalDurationMin[i]!;
    const duration = started && remaining !== NONE ? remaining : original !== NONE ? original : 0;
    work[i] = duration < 0 ? 0 : duration;
    const clock = clockOf(i);

    let start = -Infinity;
    let finish = -Infinity;
    for (let k = predOffsets[i]!; k < predOffsets[i + 1]!; k++) {
      if (ignoredPred[k]) continue;
      const pred = predTargets[k]!;
      const kind = predType[k]!;
      const fromFinish = kind !== SS && kind !== RelType.SF;
      const bound = shift(
        clockOf(pred),
        fromFinish ? earlyFinish[pred]! : earlyStart[pred]!,
        predLagMin[k]!,
      );
      // An unknown relationship type is treated as finish to start.
      if (kind === FF || kind === RelType.SF) {
        if (bound > finish) finish = bound;
      } else if (bound > start) {
        start = bound;
      }
    }
    const constraint = constraintType[i]!;
    const date = constraintDate[i]!;
    if (date !== NONE) {
      if (
        constraint === ConstraintType.StartOn ||
        constraint === ConstraintType.StartOnOrAfter ||
        constraint === ConstraintType.MandatoryStart
      ) {
        if (date > start) start = date;
      } else if (
        constraint === ConstraintType.FinishOn ||
        constraint === ConstraintType.FinishOnOrAfter ||
        constraint === ConstraintType.MandatoryFinish
      ) {
        if (date > finish) finish = date;
      }
    }
    const startBound = dataDate > start ? dataDate : start;

    if (type[i] === TaskType.FinishMilestone) {
      earlyFinish[i] = startBound > finish ? startBound : finish;
      earlyStart[i] = earlyFinish[i]!;
    } else if (type[i] === TaskType.StartMilestone) {
      earlyStart[i] = snapForward(clock, startBound > finish ? startBound : finish);
      earlyFinish[i] = earlyStart[i]!;
    } else {
      let s = snapForward(clock, startBound);
      let f = addWork(clock, s, work[i]!);
      if (finish > f) {
        f = finishOnOrAfter(clock, finish);
        s = subtractWork(clock, f, work[i]!);
      }
      earlyStart[i] = started ? actualStart[i]! : s;
      earlyFinish[i] = f;
    }
    if (earlyFinish[i]! > projectFinish) projectFinish = earlyFinish[i]!;
  }
  if (projectFinish === -Infinity) projectFinish = dataDate;

  // Backward pass.
  for (let at = n - 1; at >= 0; at--) {
    const i = order[at]!;
    if (complete[i]) continue;
    const clock = clockOf(i);
    let finishBound = Infinity;
    let startBound = Infinity;
    let free = Infinity;
    for (let k = succOffsets[i]!; k < succOffsets[i + 1]!; k++) {
      if (ignoredSucc[k]) continue;
      const succ = succTargets[k]!;
      if (complete[succ]) continue;
      const kind = succType[k]!;
      const lag = succLagMin[k]!;
      const toStart = kind !== FF && kind !== RelType.SF;
      const fromFinish = kind !== SS && kind !== RelType.SF;
      const bound = shift(clock, toStart ? lateStart[succ]! : lateFinish[succ]!, -lag);
      if (fromFinish) {
        if (bound < finishBound) finishBound = bound;
      } else if (bound < startBound) {
        startBound = bound;
      }
      const mine = fromFinish ? earlyFinish[i]! : earlyStart[i]!;
      const theirs = toStart ? earlyStart[succ]! : earlyFinish[succ]!;
      const slack = workBetween(clock, shift(clock, mine, lag), theirs);
      if (slack < free) free = slack;
    }
    if (finishBound === Infinity) finishBound = projectFinish;
    const constraint = constraintType[i]!;
    const date = constraintDate[i]!;
    if (date !== NONE) {
      if (
        constraint === ConstraintType.FinishOn ||
        constraint === ConstraintType.FinishOnOrBefore ||
        constraint === ConstraintType.MandatoryFinish
      ) {
        if (date < finishBound) finishBound = date;
      } else if (
        constraint === ConstraintType.StartOn ||
        constraint === ConstraintType.StartOnOrBefore ||
        constraint === ConstraintType.MandatoryStart
      ) {
        if (date < startBound) startBound = date;
      }
    }

    if (type[i] === TaskType.FinishMilestone || type[i] === TaskType.StartMilestone) {
      lateFinish[i] = finishBound < startBound ? finishBound : startBound;
      lateStart[i] = lateFinish[i]!;
    } else {
      let f = snapBackward(clock, finishBound);
      let s = subtractWork(clock, f, work[i]!);
      if (startBound < s) {
        s = startOnOrBefore(clock, startBound);
        f = addWork(clock, s, work[i]!);
      }
      lateStart[i] = s;
      lateFinish[i] = f;
    }
    totalFloat[i] = workBetween(clock, earlyFinish[i]!, lateFinish[i]!);
    const freeValue = free === Infinity ? totalFloat[i]! : free;
    freeFloat[i] = freeValue > 0 ? freeValue : 0;
  }

  return {
    earlyStart,
    earlyFinish,
    lateStart,
    lateFinish,
    totalFloat,
    freeFloat,
    projectFinish,
    dataDate,
    loopActivities,
    ignoredRelationships,
  };
}
