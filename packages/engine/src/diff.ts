/**
 * Compares two updates of one schedule: `a` is the previous update, `b` the
 * current one. Activities are matched by activity code, never by task id
 * (decision D4), and relationships by (predecessor, successor, type).
 *
 * The result is columnar, indexed by the activities of `b`: one bitmask of
 * change kinds per activity, plus the deltas a grid would show. Activities
 * that exist only in `a` are listed separately.
 */
import { NONE, Status, stringAt, type ScheduleData } from '@slip/xer';
import { workBetween, type WorkClock } from './worktime.ts';

/** Bits of DiffResult.flags. An activity can carry several. */
export const Change = {
  Added: 1,
  StartMoved: 2,
  FinishMoved: 4,
  DurationChanged: 8,
  Progressed: 16,
  ConstraintChanged: 32,
  LogicChanged: 64,
  FloatChanged: 128,
  JoinedCriticalPath: 256,
  LeftCriticalPath: 512,
  /** A second or later activity with a code already seen. It is left out of matching. */
  DuplicateCode: 1024,
} as const;

export type ChangeName = keyof typeof Change | 'Removed';

/** The dates and float to compare. Defaults to what each file stores; pass CPM output after an edit. */
export interface DiffDates {
  earlyStart: Int32Array;
  earlyFinish: Int32Array;
  totalFloat: Int32Array;
}

export interface DiffResult {
  /** For each activity of `b`: its index in `a`, or -1. */
  matchA: Int32Array;
  /** For each activity of `a`: its index in `b`, or -1. */
  matchB: Int32Array;
  /** For each activity of `b`: a bitmask of Change values. Zero means unchanged. */
  flags: Uint16Array;
  /**
   * Deltas for each activity of `b`, current minus previous, in working
   * minutes on the activity's own calendar. Positive means later or longer.
   * NONE where there is nothing to compare.
   */
  startDelta: Int32Array;
  finishDelta: Int32Array;
  durationDelta: Int32Array;
  floatDelta: Int32Array;
  /** Indices into `a` of activities that are not in `b`. */
  removed: Int32Array;
  /** How many activities carry each kind of change. */
  counts: Record<ChangeName, number>;
  /** Activities of `b` with any change, including added ones. */
  changed: number;
  relationships: { added: number; removed: number; lagChanged: number };
}

const CRITICAL_FLOAT = 0;

function fileDates(data: ScheduleData): DiffDates {
  return {
    earlyStart: data.earlyStart,
    earlyFinish: data.earlyFinish,
    totalFloat: data.totalFloatMin,
  };
}

/** Matches activities by code. The first activity with a code wins; later ones are flagged and left out. */
function matchByCode(
  a: ScheduleData,
  b: ScheduleData,
  flags: Uint16Array,
): { matchA: Int32Array; matchB: Int32Array; duplicateInA: Uint8Array } {
  const indexInA = new Map<string, number>();
  const duplicateInA = new Uint8Array(a.n);
  for (let i = 0; i < a.n; i++) {
    const code = stringAt(a.strings, a.taskCode[i]!);
    if (indexInA.has(code)) duplicateInA[i] = 1;
    else indexInA.set(code, i);
  }
  const matchA = new Int32Array(b.n).fill(-1);
  const matchB = new Int32Array(a.n).fill(-1);
  const seenInB = new Set<string>();
  for (let j = 0; j < b.n; j++) {
    const code = stringAt(b.strings, b.taskCode[j]!);
    if (seenInB.has(code)) {
      flags[j] = Change.DuplicateCode;
      continue;
    }
    seenInB.add(code);
    const i = indexInA.get(code);
    if (i === undefined) {
      flags[j] = Change.Added;
    } else {
      matchA[j] = i;
      matchB[i] = j;
    }
  }
  return { matchA, matchB, duplicateInA };
}

/**
 * Compares the predecessors of activity `j` in `b` with those of its match
 * `i` in `a`. Adds to the totals of relationships added, removed, or kept
 * with a different lag, marks the activities at the other end, and returns
 * whether anything differed.
 */
function comparePredecessors(
  a: ScheduleData,
  b: ScheduleData,
  matchB: Int32Array,
  i: number,
  j: number,
  touched: Uint8Array,
  totals: { added: number; removed: number; lagChanged: number },
): boolean {
  const aFrom = a.predOffsets[i]!;
  const aTo = a.predOffsets[i + 1]!;
  const bFrom = b.predOffsets[j]!;
  const bTo = b.predOffsets[j + 1]!;

  // Fast path: same relationships in the same order, which is the usual case.
  if (aTo - aFrom === bTo - bFrom) {
    let same = true;
    for (let k = 0; k < aTo - aFrom; k++) {
      if (
        matchB[a.predTargets[aFrom + k]!] !== b.predTargets[bFrom + k] ||
        a.predType[aFrom + k] !== b.predType[bFrom + k] ||
        a.predLagMin[aFrom + k] !== b.predLagMin[bFrom + k]
      ) {
        same = false;
        break;
      }
    }
    if (same) return false;
  }

  // Slow path: match by (predecessor, type), each entry of `a` used at most once.
  const used = new Uint8Array(aTo - aFrom);
  let changed = false;
  for (let kb = bFrom; kb < bTo; kb++) {
    const predB = b.predTargets[kb]!;
    let found = -1;
    for (let ka = aFrom; ka < aTo; ka++) {
      if (
        !used[ka - aFrom] &&
        matchB[a.predTargets[ka]!] === predB &&
        a.predType[ka] === b.predType[kb]
      ) {
        found = ka;
        break;
      }
    }
    if (found < 0) {
      totals.added++;
      touched[predB] = 1;
      changed = true;
    } else {
      used[found - aFrom] = 1;
      if (a.predLagMin[found] !== b.predLagMin[kb]) {
        totals.lagChanged++;
        touched[predB] = 1;
        changed = true;
      }
    }
  }
  for (let ka = aFrom; ka < aTo; ka++) {
    if (used[ka - aFrom]) continue;
    totals.removed++;
    changed = true;
    const predB = matchB[a.predTargets[ka]!]!;
    if (predB >= 0) touched[predB] = 1;
  }
  return changed;
}

export function diffSchedules(
  a: ScheduleData,
  b: ScheduleData,
  clocksB: WorkClock[],
  datesA: DiffDates = fileDates(a),
  datesB: DiffDates = fileDates(b),
): DiffResult {
  const flags = new Uint16Array(b.n);
  const { matchA, matchB, duplicateInA } = matchByCode(a, b, flags);
  const startDelta = new Int32Array(b.n).fill(NONE);
  const finishDelta = new Int32Array(b.n).fill(NONE);
  const durationDelta = new Int32Array(b.n).fill(NONE);
  const floatDelta = new Int32Array(b.n).fill(NONE);
  const relationships = { added: 0, removed: 0, lagChanged: 0 };
  /** Activities of `b` at the far end of a changed relationship. */
  const touched = new Uint8Array(b.n);

  const fallback = clocksB.length - 1;
  const defaultClock = b.calendars.defaultIndex >= 0 ? b.calendars.defaultIndex : fallback;

  for (let j = 0; j < b.n; j++) {
    const i = matchA[j]!;
    if (i < 0) {
      // Every relationship into a new activity is new, and changes the logic of its predecessor.
      // Relationships out of it are counted when its successors are compared.
      if (flags[j]! & Change.Added) {
        for (let k = b.predOffsets[j]!; k < b.predOffsets[j + 1]!; k++) {
          relationships.added++;
          touched[b.predTargets[k]!] = 1;
        }
      }
      continue;
    }
    let flag = 0;
    const calendar = b.calendarIndex[j]!;
    const clock = clocksB[calendar >= 0 && calendar < fallback ? calendar : defaultClock]!;

    // Dates: actuals where they exist, otherwise the early dates.
    const startA = a.actualStart[i] !== NONE ? a.actualStart[i]! : datesA.earlyStart[i]!;
    const startB = b.actualStart[j] !== NONE ? b.actualStart[j]! : datesB.earlyStart[j]!;
    const finishA = a.actualFinish[i] !== NONE ? a.actualFinish[i]! : datesA.earlyFinish[i]!;
    const finishB = b.actualFinish[j] !== NONE ? b.actualFinish[j]! : datesB.earlyFinish[j]!;
    if (startA !== NONE && startB !== NONE) {
      startDelta[j] = startA === startB ? 0 : workBetween(clock, startA, startB);
      if (startA !== startB) flag |= Change.StartMoved;
    }
    if (finishA !== NONE && finishB !== NONE) {
      finishDelta[j] = finishA === finishB ? 0 : workBetween(clock, finishA, finishB);
      if (finishA !== finishB) flag |= Change.FinishMoved;
    }

    const durationA = a.originalDurationMin[i]!;
    const durationB = b.originalDurationMin[j]!;
    if (durationA !== NONE && durationB !== NONE) {
      durationDelta[j] = durationB - durationA;
      if (durationA !== durationB) flag |= Change.DurationChanged;
    }

    if (
      a.status[i] !== b.status[j] ||
      a.actualStart[i] !== b.actualStart[j] ||
      a.actualFinish[i] !== b.actualFinish[j] ||
      (b.status[j] === Status.Active && a.remainingDurationMin[i] !== b.remainingDurationMin[j])
    ) {
      flag |= Change.Progressed;
    }

    if (
      a.constraintType[i] !== b.constraintType[j] ||
      a.constraintDate[i] !== b.constraintDate[j]
    ) {
      flag |= Change.ConstraintChanged;
    }

    const floatA = datesA.totalFloat[i]!;
    const floatB = datesB.totalFloat[j]!;
    if (floatA !== NONE && floatB !== NONE) {
      floatDelta[j] = floatB - floatA;
      if (floatA !== floatB) flag |= Change.FloatChanged;
    }
    // A completed activity has no float and is on no path.
    const criticalA = floatA !== NONE && floatA <= CRITICAL_FLOAT;
    const criticalB = floatB !== NONE && floatB <= CRITICAL_FLOAT;
    if (!criticalA && criticalB && a.status[i] !== Status.Complete)
      flag |= Change.JoinedCriticalPath;
    if (criticalA && !criticalB && b.status[j] !== Status.Complete) flag |= Change.LeftCriticalPath;

    if (comparePredecessors(a, b, matchB, i, j, touched, relationships)) {
      flag |= Change.LogicChanged;
    }
    flags[j] = flag;
  }

  // Removed activities. Every relationship into one is gone, and its predecessor's logic changed.
  // Relationships out of it were counted when its successors were compared.
  const removedList: number[] = [];
  for (let i = 0; i < a.n; i++) {
    if (matchB[i]! >= 0 || duplicateInA[i]) continue;
    removedList.push(i);
    for (let k = a.predOffsets[i]!; k < a.predOffsets[i + 1]!; k++) {
      relationships.removed++;
      const predB = matchB[a.predTargets[k]!]!;
      if (predB >= 0) touched[predB] = 1;
    }
  }
  for (let j = 0; j < b.n; j++) {
    if (touched[j] && matchA[j]! >= 0) flags[j]! |= Change.LogicChanged;
  }

  const counts = { Removed: removedList.length } as Record<ChangeName, number>;
  const names = Object.keys(Change) as (keyof typeof Change)[];
  for (const name of names) counts[name] = 0;
  let changed = 0;
  for (let j = 0; j < b.n; j++) {
    const flag = flags[j]!;
    if (flag === 0) continue;
    changed++;
    for (const name of names) if (flag & Change[name]) counts[name]++;
  }

  return {
    matchA,
    matchB,
    flags,
    startDelta,
    finishDelta,
    durationDelta,
    floatDelta,
    removed: Int32Array.from(removedList),
    counts,
    changed,
    relationships,
  };
}
