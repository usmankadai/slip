/**
 * Slip trace: why did this activity's finish move between two updates?
 *
 * It walks back from the activity through its driving predecessors in the
 * current update. A relationship drives when it alone would give the
 * successor the finish it has, so removing any other predecessor would
 * change nothing. The walk stops at completed work, at the data date, at a
 * constraint, or at an activity with no predecessor.
 *
 * Each activity on that driving network is then asked what it added of its
 * own: the change between its start slip and its finish slip (it took
 * longer), and the change between the slip it inherited and its start slip
 * (its tie to the predecessor changed). Those are the contributors,
 * largest first. Taking longer only counts when the activity's finish is
 * what drives the next one; an activity tied start to start can grow
 * without delaying anything.
 */
import { ConstraintType, NONE, RelType, TaskType, type ScheduleData } from '@slip/xer';
import { clockPicker, finishOnOrAfter, shift } from './cpm.ts';
import { Change, type DiffDates, type DiffResult } from './diff.ts';
import { addWork, snapForward, workBetween, type WorkClock } from './worktime.ts';

/** Why the walk stopped at an activity, or Driven if it carries on to a predecessor. */
export const TraceEnd = {
  Driven: 0,
  /** Finished work: its dates are history. */
  Complete: 1,
  /** Nothing is holding it but the data date: it has not started when it could have. */
  DataDate: 2,
  Constraint: 3,
  NoPredecessor: 4,
  /** The walk reached its size limit here. */
  Limit: 5,
} as const;

export type ContributionKind =
  /** The original duration changed. */
  | 'duration'
  /** It is taking longer than planned without a duration change: remaining work, or actual dates. */
  | 'progress'
  /** The driving relationship is new, or its lag changed. */
  | 'logic'
  /** A constraint is holding it. */
  | 'constraint'
  /** It is new in this update and sits on the driving path. */
  | 'added'
  /** It used to have float against this predecessor and now does not, or the reverse. */
  | 'driver-changed';

export interface Contribution {
  /** Activity index in the current update. */
  activity: number;
  kind: ContributionKind;
  /** Working minutes on the activity's own calendar. Negative means it recovered time. */
  minutes: number;
  /** The same in working days of that calendar, for ranking across calendars. */
  workingDays: number;
}

export interface TraceResult {
  target: number;
  /** The target's finish slip in working minutes on its own calendar, or NONE if it is new. */
  slipMinutes: number;
  slipWorkingDays: number;
  /** Activities on the driving network, the target first, then in the order reached. */
  nodes: Int32Array;
  /** Steps back from the target, per node. */
  depth: Int32Array;
  /** A TraceEnd value per node. */
  end: Uint8Array;
  /** Driving relationships between those activities. Indices are activity indices. */
  edgePred: Int32Array;
  edgeSucc: Int32Array;
  edgeType: Uint8Array;
  edgeLag: Int32Array;
  /** Largest first. */
  contributors: Contribution[];
  /** True if the walk stopped at its size limit. */
  truncated: boolean;
}

export interface TraceOptions {
  /** Most activities to visit. */
  maxNodes?: number;
  maxDepth?: number;
  /** Most contributors to return. */
  maxContributors?: number;
}

const isFinishType = (type: number) => type === RelType.FF || type === RelType.SF;
const fromFinish = (type: number) => type !== RelType.SS && type !== RelType.SF;

export function traceSlip(
  a: ScheduleData,
  b: ScheduleData,
  diff: DiffResult,
  clocksA: WorkClock[],
  clocksB: WorkClock[],
  datesA: DiffDates,
  datesB: DiffDates,
  target: number,
  options: TraceOptions = {},
): TraceResult {
  const maxNodes = options.maxNodes ?? 2000;
  const maxDepth = options.maxDepth ?? 100_000;
  const clockA = clockPicker(a, clocksA);
  const clockB = clockPicker(b, clocksB);
  const dataDate = b.meta.dataDate;
  const { predOffsets, predTargets, predType, predLagMin } = b;

  const workOf = (j: number): number => {
    const started = b.actualStart[j] !== NONE;
    const remaining = b.remainingDurationMin[j]!;
    const original = b.originalDurationMin[j]!;
    const work = started && remaining !== NONE ? remaining : original !== NONE ? original : 0;
    return work < 0 ? 0 : work;
  };
  /** Would this bound, on its own, give activity j the finish it has? */
  const reproduces = (j: number, bound: number, finishType: boolean): boolean => {
    const clock = clockB(j);
    const finish = datesB.earlyFinish[j]!;
    const type = b.type[j]!;
    if (type === TaskType.FinishMilestone) return bound === finish;
    if (finishType) return finishOnOrAfter(clock, bound) === finish;
    const fromBound = snapForward(clock, bound);
    const used = dataDate !== NONE && dataDate > bound ? snapForward(clock, dataDate) : fromBound;
    if (fromBound !== used) return false; // the data date, not the predecessor, sets the start
    if (type === TaskType.StartMilestone) return used === finish;
    return addWork(clock, used, workOf(j)) === finish;
  };
  const boundOf = (k: number): number => {
    const pred = predTargets[k]!;
    const type = predType[k]!;
    const from = fromFinish(type) ? datesB.earlyFinish[pred]! : datesB.earlyStart[pred]!;
    return shift(clockB(pred), from, predLagMin[k]!);
  };

  const nodes: number[] = [target];
  const depth: number[] = [0];
  const end: number[] = [];
  const edges: number[] = []; // positions in b's predecessor arrays
  /** The first driving relationship of each node, as a position in b's predecessor arrays, or -1. */
  const firstDriver: number[] = [];
  const position = new Map<number, number>([[target, 0]]);
  /**
   * Whether an activity's finish matters to the target: true for the target, and for any
   * activity that drives its successor from its finish. One that only drives from its
   * start (start to start) can take longer without delaying anything downstream.
   */
  const finishMatters: boolean[] = [true];
  let truncated = false;

  for (let at = 0; at < nodes.length; at++) {
    const j = nodes[at]!;
    firstDriver[at] = -1;
    if (b.actualFinish[j] !== NONE) {
      end[at] = TraceEnd.Complete;
      continue;
    }
    if (depth[at]! >= maxDepth) {
      end[at] = TraceEnd.Limit;
      truncated = true;
      continue;
    }
    let driven = false;
    for (let k = predOffsets[j]!; k < predOffsets[j + 1]!; k++) {
      if (!reproduces(j, boundOf(k), isFinishType(predType[k]!))) continue;
      const pred = predTargets[k]!;
      if (!position.has(pred)) {
        if (nodes.length >= maxNodes) {
          truncated = true;
          continue;
        }
        position.set(pred, nodes.length);
        nodes.push(pred);
        depth.push(depth[at]! + 1);
        finishMatters.push(false);
      }
      if (position.has(pred) && fromFinish(predType[k]!)) finishMatters[position.get(pred)!] = true;
      if (firstDriver[at] === -1) firstDriver[at] = k;
      edges.push(k, j);
      driven = true;
    }
    if (driven) {
      end[at] = TraceEnd.Driven;
      continue;
    }
    const constraint = b.constraintType[j]!;
    const date = b.constraintDate[j]!;
    const startKind =
      constraint === ConstraintType.StartOn ||
      constraint === ConstraintType.StartOnOrAfter ||
      constraint === ConstraintType.MandatoryStart;
    const finishKind =
      constraint === ConstraintType.FinishOn ||
      constraint === ConstraintType.FinishOnOrAfter ||
      constraint === ConstraintType.MandatoryFinish;
    if (date !== NONE && (startKind || finishKind) && reproduces(j, date, finishKind)) {
      end[at] = TraceEnd.Constraint;
    } else if (predOffsets[j + 1]! === predOffsets[j]! && b.actualStart[j] !== NONE) {
      end[at] = TraceEnd.NoPredecessor;
    } else if (predOffsets[j + 1]! === predOffsets[j]! && dataDate === NONE) {
      end[at] = TraceEnd.NoPredecessor;
    } else {
      end[at] = TraceEnd.DataDate;
    }
  }

  // What each activity on the network added of its own.
  const contributors: Contribution[] = [];
  const add = (activity: number, kind: ContributionKind, minutes: number) => {
    if (minutes === 0) return;
    const dayMinutes = clockB(activity).calendar.dayMinutes || 480;
    contributors.push({ activity, kind, minutes, workingDays: minutes / dayMinutes });
  };
  for (let at = 0; at < nodes.length; at++) {
    const j = nodes[at]!;
    const i = diff.matchA[j]!;
    const clock = clockB(j);
    if (i < 0) {
      // New work on the driving path: everything it takes is new.
      if (diff.flags[j]! & Change.Added) {
        add(j, 'added', workBetween(clock, datesB.earlyStart[j]!, datesB.earlyFinish[j]!));
      }
      continue;
    }
    const startSlip = diff.startDelta[j]!;
    const finishSlip = diff.finishDelta[j]!;
    if (startSlip === NONE || finishSlip === NONE) continue;
    if (finishMatters[at]) {
      add(
        j,
        diff.flags[j]! & Change.DurationChanged ? 'duration' : 'progress',
        finishSlip - startSlip,
      );
    }
    if (startSlip === 0) continue;

    const k = firstDriver[at]!;
    if (k < 0) {
      if (end[at] === TraceEnd.Constraint) add(j, 'constraint', startSlip);
      else if (end[at] === TraceEnd.DataDate) add(j, 'progress', startSlip);
      continue;
    }
    // Finish-type drivers move the finish, which the first part already measured.
    if (isFinishType(predType[k]!)) continue;
    const predA = diff.matchA[predTargets[k]!]!;
    let previous = -1;
    if (predA >= 0) {
      for (let q = a.predOffsets[i]!; q < a.predOffsets[i + 1]!; q++) {
        if (a.predTargets[q] === predA && a.predType[q] === predType[k]) {
          previous = q;
          break;
        }
      }
    }
    if (previous < 0) {
      add(j, 'logic', startSlip); // the relationship that drives it is new
      continue;
    }
    const fromA = fromFinish(a.predType[previous]!)
      ? datesA.earlyFinish[predA]!
      : datesA.earlyStart[predA]!;
    if (fromA === NONE) continue;
    const boundA = shift(clockA(predA), fromA, a.predLagMin[previous]!);
    const inherited = workBetween(clock, boundA, boundOf(k));
    const gap = startSlip - inherited;
    add(j, a.predLagMin[previous] !== predLagMin[k] ? 'logic' : 'driver-changed', gap);
  }
  contributors.sort((x, y) => y.workingDays - x.workingDays || x.activity - y.activity);

  const edgeCount = edges.length / 2;
  const edgePred = new Int32Array(edgeCount);
  const edgeSucc = new Int32Array(edgeCount);
  const edgeType = new Uint8Array(edgeCount);
  const edgeLag = new Int32Array(edgeCount);
  for (let e = 0; e < edgeCount; e++) {
    const k = edges[e * 2]!;
    edgePred[e] = predTargets[k]!;
    edgeSucc[e] = edges[e * 2 + 1]!;
    edgeType[e] = predType[k]!;
    edgeLag[e] = predLagMin[k]!;
  }
  const slip = diff.finishDelta[target]!;
  const targetDay = clockB(target).calendar.dayMinutes || 480;
  return {
    target,
    slipMinutes: slip,
    slipWorkingDays: slip === NONE ? 0 : slip / targetDay,
    nodes: Int32Array.from(nodes),
    depth: Int32Array.from(depth),
    end: Uint8Array.from(end),
    edgePred,
    edgeSucc,
    edgeType,
    edgeLag,
    contributors: contributors.slice(0, options.maxContributors ?? 200),
    truncated,
  };
}
