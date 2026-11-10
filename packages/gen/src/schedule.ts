/**
 * The generator's own scheduler: a plain forward and backward pass with
 * retained logic. It is written to be easy to check, not to be fast or
 * incremental; the engine's CPM is validated against the dates it produces.
 *
 * The rules it follows are the conventions the synthetic files use:
 * - Lag is measured on the predecessor's calendar.
 * - A completed activity keeps its actual dates and constrains nothing in the backward pass.
 * - Work cannot be scheduled before the data date.
 * - An activity with no incomplete successor may finish as late as the project does.
 * - Total float is finish float, measured on the activity's own calendar.
 */
import {
  addWork,
  compileCalendar,
  snapBackward,
  snapForward,
  subtractWork,
  workBetween,
  type WorkClock,
} from '@slip/engine';
import { ConstraintType, MINUTES_PER_DAY, NONE, RelType, Status, TaskType } from '@slip/xer';
import type { Network } from './network.ts';

export interface Progress {
  /** Actual start per activity, or NONE. */
  actualStart: Int32Array;
  /** Actual finish per activity, or NONE. */
  actualFinish: Int32Array;
  /** Remaining duration in minutes for activities in progress. */
  remaining: Int32Array;
}

export interface Schedule {
  dataDate: number;
  status: Uint8Array;
  earlyStart: Int32Array;
  earlyFinish: Int32Array;
  lateStart: Int32Array;
  lateFinish: Int32Array;
  actualStart: Int32Array;
  actualFinish: Int32Array;
  remaining: Int32Array;
  totalFloat: Int32Array;
  freeFloat: Int32Array;
}

/** Relationships grouped by successor and by predecessor, skipping removed ones. */
export interface Links {
  predOffsets: Int32Array;
  /** Relationship numbers, grouped by successor. */
  predRels: Int32Array;
  succOffsets: Int32Array;
  succRels: Int32Array;
}

export function buildLinks(net: Network): Links {
  const n = net.code.length;
  const predOffsets = new Int32Array(n + 1);
  const succOffsets = new Int32Array(n + 1);
  const live = (r: number) =>
    !net.relRemoved[r] && !net.removed[net.relPred[r]!] && !net.removed[net.relSucc[r]!];
  let count = 0;
  for (let r = 0; r < net.relPred.length; r++) {
    if (!live(r)) continue;
    predOffsets[net.relSucc[r]! + 1]!++;
    succOffsets[net.relPred[r]! + 1]!++;
    count++;
  }
  for (let i = 0; i < n; i++) {
    predOffsets[i + 1]! += predOffsets[i]!;
    succOffsets[i + 1]! += succOffsets[i]!;
  }
  const predRels = new Int32Array(count);
  const succRels = new Int32Array(count);
  const predCursor = predOffsets.slice(0, n);
  const succCursor = succOffsets.slice(0, n);
  for (let r = 0; r < net.relPred.length; r++) {
    if (!live(r)) continue;
    predRels[predCursor[net.relSucc[r]!]!++] = r;
    succRels[succCursor[net.relPred[r]!]!++] = r;
  }
  return { predOffsets, predRels, succOffsets, succRels };
}

export function makeClocks(net: Network): WorkClock[] {
  const startDay = Math.floor(net.projectStart / MINUTES_PER_DAY);
  return net.calendars.map((calendar) =>
    compileCalendar(calendar, startDay - 365 * 5, startDay + 365 * 80),
  );
}

export function noProgress(n: number): Progress {
  return {
    actualStart: new Int32Array(n).fill(NONE),
    actualFinish: new Int32Array(n).fill(NONE),
    remaining: new Int32Array(n).fill(NONE),
  };
}

/** Moves a date by a lag measured on the given calendar. */
function shift(clock: WorkClock, t: number, lag: number): number {
  return lag > 0 ? addWork(clock, t, lag) : lag < 0 ? subtractWork(clock, t, -lag) : t;
}

/** The earliest valid finish at or after t. */
function finishOnOrAfter(clock: WorkClock, t: number): number {
  const back = snapBackward(clock, t);
  return back >= t ? back : snapForward(clock, t);
}

/** The latest valid start at or before t. */
function startOnOrBefore(clock: WorkClock, t: number): number {
  const forward = snapForward(clock, t);
  return forward <= t ? forward : snapBackward(clock, t);
}

const NEVER = -Infinity;
const FOREVER = Infinity;

/**
 * The earliest start and finish that an activity's predecessors and
 * constraints allow, before its own duration is applied. Shared with the
 * driving-path walk so both always agree on what "drives" means.
 */
export function forwardBounds(
  net: Network,
  clocks: WorkClock[],
  links: Links,
  earlyStart: Int32Array,
  earlyFinish: Int32Array,
  i: number,
): { start: number; finish: number; startPred: number; finishPred: number } {
  let start = NEVER;
  let finish = NEVER;
  let startPred = -1;
  let finishPred = -1;
  for (let k = links.predOffsets[i]!; k < links.predOffsets[i + 1]!; k++) {
    const r = links.predRels[k]!;
    const pred = net.relPred[r]!;
    const clock = clocks[net.calendar[pred]!]!;
    const type = net.relType[r]!;
    const from =
      type === RelType.FS || type === RelType.FF ? earlyFinish[pred]! : earlyStart[pred]!;
    const bound = shift(clock, from, net.relLag[r]!);
    if (type === RelType.FS || type === RelType.SS) {
      if (bound > start) {
        start = bound;
        startPred = pred;
      }
    } else if (bound > finish) {
      finish = bound;
      finishPred = pred;
    }
  }
  const constraint = net.constraintType[i]!;
  const date = net.constraintDate[i]!;
  if (constraint === ConstraintType.StartOn || constraint === ConstraintType.StartOnOrAfter) {
    if (date > start) {
      start = date;
      startPred = -1;
    }
  } else if (
    constraint === ConstraintType.FinishOn ||
    constraint === ConstraintType.FinishOnOrAfter
  ) {
    if (date > finish) {
      finish = date;
      finishPred = -1;
    }
  }
  return { start, finish, startPred, finishPred };
}

export function schedule(
  net: Network,
  clocks: WorkClock[],
  links: Links,
  dataDate: number,
  progress: Progress,
): Schedule {
  const n = net.code.length;
  const { actualStart, actualFinish, remaining } = progress;
  const status = new Uint8Array(n);
  const earlyStart = new Int32Array(n).fill(NONE);
  const earlyFinish = new Int32Array(n).fill(NONE);
  const lateStart = new Int32Array(n).fill(NONE);
  const lateFinish = new Int32Array(n).fill(NONE);
  const totalFloat = new Int32Array(n).fill(NONE);
  const freeFloat = new Int32Array(n).fill(NONE);
  const remainingOut = new Int32Array(n);

  // Forward pass. Index order is a valid order (see network.ts).
  let projectFinish = NEVER;
  for (let i = 0; i < n; i++) {
    if (net.removed[i]) continue;
    if (actualFinish[i] !== NONE) {
      status[i] = Status.Complete;
      earlyStart[i] = actualStart[i]!;
      earlyFinish[i] = actualFinish[i]!;
      projectFinish = Math.max(projectFinish, earlyFinish[i]!);
      continue;
    }
    const started = actualStart[i] !== NONE;
    status[i] = started ? Status.Active : Status.NotStarted;
    const work = started ? remaining[i]! : net.duration[i]!;
    remainingOut[i] = work;
    const clock = clocks[net.calendar[i]!]!;
    const bounds = forwardBounds(net, clocks, links, earlyStart, earlyFinish, i);
    const startBound = Math.max(dataDate, bounds.start);
    const type = net.type[i]!;

    if (type === TaskType.FinishMilestone) {
      earlyFinish[i] = Math.max(startBound, bounds.finish);
      earlyStart[i] = earlyFinish[i]!;
    } else if (type === TaskType.StartMilestone) {
      earlyStart[i] = snapForward(clock, Math.max(startBound, bounds.finish));
      earlyFinish[i] = earlyStart[i]!;
    } else {
      let start = snapForward(clock, startBound);
      let finish = addWork(clock, start, work);
      if (bounds.finish > finish) {
        finish = finishOnOrAfter(clock, bounds.finish);
        start = subtractWork(clock, finish, work);
      }
      earlyStart[i] = started ? actualStart[i]! : start;
      earlyFinish[i] = finish;
    }
    projectFinish = Math.max(projectFinish, earlyFinish[i]!);
  }

  // Backward pass.
  for (let i = n - 1; i >= 0; i--) {
    if (net.removed[i] || status[i] === Status.Complete) continue;
    const clock = clocks[net.calendar[i]!]!;
    let finishBound = FOREVER;
    let startBound = FOREVER;
    let free = FOREVER;
    for (let k = links.succOffsets[i]!; k < links.succOffsets[i + 1]!; k++) {
      const r = links.succRels[k]!;
      const succ = net.relSucc[r]!;
      if (status[succ] === Status.Complete) continue;
      const type = net.relType[r]!;
      const lag = net.relLag[r]!;
      const to = type === RelType.FS || type === RelType.SS ? lateStart[succ]! : lateFinish[succ]!;
      const bound = shift(clock, to, -lag);
      if (type === RelType.FS || type === RelType.FF) finishBound = Math.min(finishBound, bound);
      else startBound = Math.min(startBound, bound);

      const mine = type === RelType.FS || type === RelType.FF ? earlyFinish[i]! : earlyStart[i]!;
      const theirs =
        type === RelType.FS || type === RelType.SS ? earlyStart[succ]! : earlyFinish[succ]!;
      free = Math.min(free, workBetween(clock, shift(clock, mine, lag), theirs));
    }
    if (finishBound === FOREVER) finishBound = projectFinish;
    const constraint = net.constraintType[i]!;
    const date = net.constraintDate[i]!;
    if (constraint === ConstraintType.FinishOn || constraint === ConstraintType.FinishOnOrBefore) {
      finishBound = Math.min(finishBound, date);
    } else if (
      constraint === ConstraintType.StartOn ||
      constraint === ConstraintType.StartOnOrBefore
    ) {
      startBound = Math.min(startBound, date);
    }

    const type = net.type[i]!;
    if (type === TaskType.FinishMilestone || type === TaskType.StartMilestone) {
      lateFinish[i] = Math.min(finishBound, startBound);
      lateStart[i] = lateFinish[i]!;
    } else {
      const work = remainingOut[i]!;
      let finish = snapBackward(clock, finishBound);
      let start = subtractWork(clock, finish, work);
      if (startBound < start) {
        start = startOnOrBefore(clock, startBound);
        finish = addWork(clock, start, work);
      }
      lateStart[i] = start;
      lateFinish[i] = finish;
    }
    totalFloat[i] = workBetween(clock, earlyFinish[i]!, lateFinish[i]!);
    freeFloat[i] = Math.max(0, free === FOREVER ? totalFloat[i]! : free);
  }

  return {
    dataDate,
    status,
    earlyStart,
    earlyFinish,
    lateStart,
    lateFinish,
    actualStart,
    actualFinish,
    remaining: remainingOut,
    totalFloat,
    freeFloat,
  };
}

/**
 * Progress as it would stand at `dataDate` if the work had gone exactly to
 * the dates in `plan`: finished activities get their planned dates as
 * actuals, and activities under way get the planned work still to do.
 */
export function progressAt(
  net: Network,
  clocks: WorkClock[],
  plan: Schedule,
  dataDate: number,
): Progress {
  const n = net.code.length;
  const progress = noProgress(n);
  for (let i = 0; i < n; i++) {
    if (net.removed[i] || plan.earlyStart[i] === NONE) continue;
    if (plan.earlyFinish[i]! <= dataDate) {
      progress.actualStart[i] = plan.earlyStart[i]!;
      progress.actualFinish[i] = plan.earlyFinish[i]!;
    } else if (plan.earlyStart[i]! < dataDate) {
      progress.actualStart[i] = plan.earlyStart[i]!;
      progress.remaining[i] = workBetween(
        clocks[net.calendar[i]!]!,
        dataDate,
        plan.earlyFinish[i]!,
      );
    }
  }
  return progress;
}

/**
 * The chain of activities that sets an activity's early finish, walking back
 * from `from` through whichever predecessor drives each one. Stops at
 * completed work, at the data date, or at a constraint.
 */
export function drivingPath(
  net: Network,
  clocks: WorkClock[],
  links: Links,
  plan: Schedule,
  from: number,
): number[] {
  const path: number[] = [];
  let i = from;
  while (i >= 0 && plan.status[i] !== Status.Complete) {
    path.push(i);
    const bounds = forwardBounds(net, clocks, links, plan.earlyStart, plan.earlyFinish, i);
    // Whichever bound produced the finish we see is the driver.
    const byFinish = bounds.finishPred >= 0 && bounds.finish >= plan.earlyFinish[i]!;
    const next = byFinish ? bounds.finishPred : bounds.startPred;
    if (next < 0 || (!byFinish && bounds.start < plan.dataDate)) break;
    i = next;
  }
  return path;
}
