/**
 * Where the marks for one activity go on the Gantt (exploration 02, option C):
 * the bar for this update, and only the difference from the previous one.
 * Pure: pixels in, pixels out. The painter draws what this returns.
 */
import { NONE } from '@slip/xer';
import { xOf, type TimeScale } from './scale.ts';

export interface GanttRow {
  /** This update: start and finish in minutes since the epoch, or NONE. */
  start: number;
  finish: number;
  /** The previous update, or NONE when the activity is new or has no dates. */
  previousStart: number;
  previousFinish: number;
  milestone: boolean;
  critical: boolean;
  /** Share of the work done, 0 to 1. */
  progress: number;
}

export interface Span {
  x: number;
  width: number;
}

export interface RowMarks {
  /** The bar for this update, or null when it has no dates or is out of view. */
  bar: Span | null;
  /** Centre of the diamond for a milestone that is in view. */
  diamond: number | null;
  /** The part of the bar that is done. */
  progress: Span | null;
  /** From the previous finish to this one. `late` says which way it moved. */
  tail: (Span & { late: boolean }) | null;
  /** A tick where the finish was, when that is in view. */
  previousFinish: number | null;
  /** A tick where the start was, when it moved and is in view. */
  previousStart: number | null;
  /** The previous finish is beyond this edge of the view. */
  previousOff: 'left' | 'right' | null;
  /** The whole of this update's bar is beyond this edge of the view. */
  barOff: 'left' | 'right' | null;
  /** The previous bar in full. Drawn only for the selected activity. */
  ghost: Span | null;
}

/** A tail is never thinner than this, so a one-day move stays visible at any zoom. */
export const MIN_TAIL = 3;
/** A bar is never thinner than this. */
export const MIN_BAR = 2;

const EMPTY: RowMarks = {
  bar: null,
  diamond: null,
  progress: null,
  tail: null,
  previousFinish: null,
  previousStart: null,
  previousOff: null,
  barOff: null,
  ghost: null,
};

const within = (x: number, width: number) => x >= 0 && x <= width;

export function rowMarks(row: GanttRow, scale: TimeScale, width: number): RowMarks {
  if (row.finish === NONE || !(width > 0)) return EMPTY;
  const start = row.start === NONE ? row.finish : row.start;
  const x0 = xOf(start, scale);
  const x1 = xOf(row.finish, scale);
  const marks: RowMarks = { ...EMPTY };

  if (x1 < 0) marks.barOff = 'left';
  else if (x0 > width) marks.barOff = 'right';
  else if (row.milestone) marks.diamond = x1;
  else {
    marks.bar = { x: x0, width: Math.max(x1 - x0, MIN_BAR) };
    const done = Math.min(Math.max(row.progress, 0), 1);
    if (done > 0) marks.progress = { x: x0, width: marks.bar.width * done };
  }

  if (row.previousFinish === NONE) return marks;
  const p1 = xOf(row.previousFinish, scale);
  const p0 = row.previousStart === NONE ? p1 : xOf(row.previousStart, scale);
  if (!row.milestone) marks.ghost = { x: p0, width: Math.max(p1 - p0, MIN_BAR) };

  if (row.previousFinish !== row.finish) {
    const late = row.finish > row.previousFinish;
    // The tail runs between the two finishes, cut to the view, and is given a minimum size.
    const from = Math.min(Math.max(Math.min(p1, x1), 0), width);
    const to = Math.min(Math.max(Math.max(p1, x1), 0), width);
    if (to > 0 && from < width) {
      const length = Math.max(to - from, MIN_TAIL);
      // A short tail grows away from the bar's end: back for a late move, forward for an early one.
      marks.tail = { x: late ? to - length : from, width: length, late };
    }
    if (within(p1, width)) marks.previousFinish = p1;
    else marks.previousOff = p1 < 0 ? 'left' : 'right';
  }
  if (
    !row.milestone &&
    row.previousStart !== NONE &&
    row.previousStart !== start &&
    within(p0, width)
  ) {
    marks.previousStart = p0;
  }
  return marks;
}
