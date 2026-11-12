import { describe, expect, it } from 'vitest';
import { NONE, daysFromCivil } from '@slip/xer';
import { MIN_BAR, MIN_TAIL, rowMarks, type GanttRow } from './geometry.ts';
import {
  originFor,
  originToFit,
  originToReveal,
  ticks,
  timeAt,
  xOf,
  type TimeScale,
} from './scale.ts';

const DAY = 1440;
// One pixel a day, with day 0 at the left edge: positions are day numbers.
const scale: TimeScale = { origin: 0, pxPerDay: 1 };
const WIDTH = 600;
const row = (over: Partial<GanttRow> = {}): GanttRow => ({
  start: 100 * DAY,
  finish: 140 * DAY,
  previousStart: 100 * DAY,
  previousFinish: 140 * DAY,
  milestone: false,
  critical: false,
  progress: 0,
  ...over,
});

describe('time scale', () => {
  it('places a moment and finds it again', () => {
    const months: TimeScale = { origin: 50 * DAY, pxPerDay: 2 };
    expect(xOf(60 * DAY, months)).toBe(20);
    expect(timeAt(20, months)).toBe(60 * DAY);
    expect(xOf(timeAt(123.5, months), months)).toBeCloseTo(123.5, 6);
  });

  it('finds the origin that puts a moment part of the way across', () => {
    const origin = originFor(200 * DAY, 0.25, 800, 2);
    expect(xOf(200 * DAY, { origin, pxPerDay: 2 })).toBeCloseTo(200, 6);
  });

  it('labels every month when there is room, and marks the new year', () => {
    const june2026 = (daysFromCivil(2026, 6, 1) - daysFromCivil(2000, 1, 1)) * DAY;
    const out = ticks({ origin: june2026, pxPerDay: 2 }, 600);
    expect(out.slice(0, 3).map((tick) => tick.label)).toEqual(['Jun', 'Jul', 'Aug']);
    expect(out.find((tick) => tick.major)?.label).toBe('2027');
    expect(out[0]!.x).toBe(0);
    expect(out[1]!.x).toBe(60);
  });

  it('labels less often when months are narrow', () => {
    const jan2026 = (daysFromCivil(2026, 1, 1) - daysFromCivil(2000, 1, 1)) * DAY;
    const quarters = ticks({ origin: jan2026, pxPerDay: 0.8 }, 600).filter((tick) => tick.label);
    expect(quarters.slice(0, 3).map((tick) => tick.label)).toEqual(['2026', 'Apr', 'Jul']);
    const years = ticks({ origin: jan2026, pxPerDay: 0.2 }, 600);
    expect(years.every((tick) => /^\d{4}$/.test(tick.label))).toBe(true);
  });

  it('gives nothing for a view with no width or a bad scale', () => {
    expect(ticks(scale, 0)).toEqual([]);
    expect(ticks({ origin: 0, pxPerDay: 0 }, 600)).toEqual([]);
    expect(ticks({ origin: 0, pxPerDay: Number.NaN }, 600)).toEqual([]);
  });
});

describe('placing the axis', () => {
  it('fits to the earliest bar, a tenth of the way in', () => {
    const origin = originToFit([300 * DAY, NONE, 120 * DAY], 600, 2, NONE)!;
    expect(xOf(120 * DAY, { origin, pxPerDay: 2 })).toBeCloseTo(60, 6);
  });

  it('has nothing to fit to when no row has a date', () => {
    expect(originToFit([NONE, NONE], 600, 2, NONE)).toBeNull();
    expect(originToFit([], 600, 2, NONE)).toBeNull();
  });

  it('leaves the axis alone when the bar is already in view', () => {
    expect(originToReveal(100 * DAY, 140 * DAY, scale, 600)).toBe(0);
  });

  it('moves the axis to a bar that is out of view, either side', () => {
    const later = originToReveal(900 * DAY, 940 * DAY, scale, 600);
    expect(xOf(900 * DAY, { origin: later, pxPerDay: 1 })).toBeCloseTo(60, 6);
    const earlier = originToReveal(-300 * DAY, -260 * DAY, scale, 600);
    expect(xOf(-300 * DAY, { origin: earlier, pxPerDay: 1 })).toBeCloseTo(60, 6);
  });

  it('leaves the axis alone for a bar that fills the whole view', () => {
    expect(originToReveal(-100 * DAY, 900 * DAY, scale, 600)).toBe(0);
  });
});

describe('row marks', () => {
  it('draws only the bar for an activity that did not move', () => {
    const marks = rowMarks(row(), scale, WIDTH);
    expect(marks.bar).toEqual({ x: 100, width: 40 });
    expect(marks.tail).toBeNull();
    expect(marks.previousFinish).toBeNull();
    expect(marks.previousStart).toBeNull();
  });

  it('draws a tail back to the previous finish for a late move', () => {
    const marks = rowMarks(row({ start: 114 * DAY, finish: 160 * DAY }), scale, WIDTH);
    expect(marks.tail).toEqual({ x: 140, width: 20, late: true });
    expect(marks.previousFinish).toBe(140);
    expect(marks.previousStart).toBe(100);
  });

  it('draws the tail forward of the bar for an earlier finish', () => {
    const marks = rowMarks(row({ start: 90 * DAY, finish: 128 * DAY }), scale, WIDTH);
    expect(marks.tail).toEqual({ x: 128, width: 12, late: false });
  });

  it('keeps a one-day move visible when a day is less than a pixel', () => {
    const years: TimeScale = { origin: 0, pxPerDay: 0.4 };
    const late = rowMarks(row({ finish: 141 * DAY }), years, WIDTH);
    expect(late.tail?.width).toBe(MIN_TAIL);
    expect(late.tail!.x + late.tail!.width).toBeCloseTo(xOf(141 * DAY, years), 6);
    const early = rowMarks(row({ finish: 139 * DAY }), years, WIDTH);
    expect(early.tail).toEqual({ x: xOf(139 * DAY, years), width: MIN_TAIL, late: false });
  });

  it('shows growth when the duration grew and the start did not move', () => {
    const marks = rowMarks(row({ finish: 162 * DAY }), scale, WIDTH);
    expect(marks.tail).toEqual({ x: 140, width: 22, late: true });
    expect(marks.previousStart).toBeNull();
  });

  it('says so when the previous finish is off the edge, and runs the tail in from it', () => {
    const marks = rowMarks(
      row({ previousStart: -70 * DAY, previousFinish: -30 * DAY }),
      scale,
      WIDTH,
    );
    expect(marks.previousOff).toBe('left');
    expect(marks.previousFinish).toBeNull();
    expect(marks.tail).toEqual({ x: 0, width: 140, late: true });
  });

  it('says which edge a bar is beyond when none of it is in view', () => {
    expect(rowMarks(row({ start: -50 * DAY, finish: -10 * DAY }), scale, WIDTH)).toMatchObject({
      bar: null,
      barOff: 'left',
    });
    expect(rowMarks(row({ start: 700 * DAY, finish: 800 * DAY }), scale, WIDTH)).toMatchObject({
      bar: null,
      barOff: 'right',
    });
  });

  it('draws nothing from the previous update for a new activity', () => {
    const marks = rowMarks(row({ previousStart: NONE, previousFinish: NONE }), scale, WIDTH);
    expect(marks.bar).not.toBeNull();
    expect(marks).toMatchObject({
      tail: null,
      ghost: null,
      previousFinish: null,
      previousOff: null,
    });
  });

  it('draws a milestone as a diamond with a tail and no bar', () => {
    const marks = rowMarks(
      row({
        start: 154 * DAY,
        finish: 154 * DAY,
        previousStart: 128 * DAY,
        previousFinish: 128 * DAY,
        milestone: true,
      }),
      scale,
      WIDTH,
    );
    expect(marks).toMatchObject({ bar: null, diamond: 154, ghost: null, previousStart: null });
    expect(marks.tail).toEqual({ x: 128, width: 26, late: true });
  });

  it('fills the done part of the bar and never more than the bar', () => {
    expect(rowMarks(row({ progress: 0.6 }), scale, WIDTH).progress).toEqual({ x: 100, width: 24 });
    expect(rowMarks(row({ progress: 7 }), scale, WIDTH).progress).toEqual({ x: 100, width: 40 });
    expect(rowMarks(row({ progress: -1 }), scale, WIDTH).progress).toBeNull();
    expect(rowMarks(row({ progress: Number.NaN }), scale, WIDTH).progress).toBeNull();
  });

  it('gives the previous bar in full, for the selected activity', () => {
    expect(rowMarks(row({ finish: 160 * DAY }), scale, WIDTH).ghost).toEqual({ x: 100, width: 40 });
  });

  it('never draws a bar thinner than the minimum', () => {
    expect(
      rowMarks(row({ start: 100 * DAY, finish: 100 * DAY + 60 }), scale, WIDTH).bar?.width,
    ).toBe(MIN_BAR);
  });

  it('draws nothing for an activity with no dates, or a view with no width', () => {
    expect(rowMarks(row({ finish: NONE }), scale, WIDTH).bar).toBeNull();
    expect(rowMarks(row(), scale, 0).bar).toBeNull();
  });
});
