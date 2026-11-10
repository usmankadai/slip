import { describe, expect, it } from 'vitest';
import { parseCalendar, parseXerDate, periodsOn, type Calendar } from '@slip/xer';
import {
  addWork,
  compileCalendar,
  finishAtWork,
  snapBackward,
  snapForward,
  startAtWork,
  subtractWork,
  workAt,
  workBetween,
} from '../src/index.ts';

const at = parseXerDate;
const day = (text: string) => at(text) / 1440;

// Monday to Friday 08:00-12:00 and 13:00-17:00, with 25 December 2025 off and a half day on the 26th.
const DATA =
  '(0||CalendarData()( (0||DaysOfWeek()( (0||1()()) ' +
  [2, 3, 4, 5, 6]
    .map((d) => `(0||${d}()( (0||0(s|08:00|f|12:00)()) (0||1(s|13:00|f|17:00)()) ))`)
    .join(' ') +
  ' (0||7()()) )) (0||Exceptions()( (0||0(d|46016)()) (0||1(d|46017)( (0||0(s|08:00|f|12:00)()) )) )) ))';
const calendar = parseCalendar(1, 'Standard', 480, DATA);
const clock = compileCalendar(calendar, day('2025-01-01'), day('2027-01-01'));

/** The slow, obviously right way: is this single minute a working minute? */
function isWorking(cal: Calendar, minute: number): boolean {
  const d = Math.floor(minute / 1440);
  const m = minute - d * 1440;
  const periods = periodsOn(cal, d);
  for (let i = 0; i < periods.length; i += 2)
    if (m >= periods[i]! && m < periods[i + 1]!) return true;
  return false;
}

describe('working time', () => {
  it('finishes a day of work the same afternoon and starts the next piece the next morning', () => {
    // Monday 5 January 2026
    expect(addWork(clock, at('2026-01-05 08:00'), 480)).toBe(at('2026-01-05 17:00'));
    expect(snapForward(clock, at('2026-01-05 17:00'))).toBe(at('2026-01-06 08:00'));
    expect(snapBackward(clock, at('2026-01-06 08:00'))).toBe(at('2026-01-05 17:00'));
  });

  it('skips lunch, weekends and holidays', () => {
    expect(addWork(clock, at('2026-01-05 11:00'), 120)).toBe(at('2026-01-05 14:00'));
    expect(addWork(clock, at('2026-01-09 08:00'), 960)).toBe(at('2026-01-12 17:00')); // over a weekend
    // Wednesday 24 December, two days of work: Thursday is off, Friday is a half day.
    expect(addWork(clock, at('2025-12-24 08:00'), 960)).toBe(at('2025-12-29 12:00'));
    expect(snapForward(clock, at('2025-12-25 10:00'))).toBe(at('2025-12-26 08:00'));
    expect(snapForward(clock, at('2025-12-26 12:30'))).toBe(at('2025-12-29 08:00'));
  });

  it('leaves a moment inside a working period where it is', () => {
    for (const text of ['2026-01-05 08:00', '2026-01-05 09:17', '2026-01-05 13:00']) {
      expect(snapForward(clock, at(text))).toBe(at(text));
    }
    for (const text of ['2026-01-05 12:00', '2026-01-05 09:17', '2026-01-05 17:00']) {
      expect(snapBackward(clock, at(text))).toBe(at(text));
    }
  });

  it('subtracts work back to a start', () => {
    expect(subtractWork(clock, at('2026-01-05 17:00'), 480)).toBe(at('2026-01-05 08:00'));
    expect(subtractWork(clock, at('2026-01-12 17:00'), 960)).toBe(at('2026-01-09 08:00'));
    expect(subtractWork(clock, at('2026-01-05 08:00'), 60)).toBe(at('2026-01-02 16:00'));
  });

  it('measures float, with a sign', () => {
    expect(workBetween(clock, at('2026-01-05 17:00'), at('2026-01-06 17:00'))).toBe(480);
    expect(workBetween(clock, at('2026-01-06 17:00'), at('2026-01-05 17:00'))).toBe(-480);
    expect(workBetween(clock, at('2026-01-09 17:00'), at('2026-01-12 08:00'))).toBe(0);
  });

  it('treats zero work as no movement, and negative work as the opposite direction', () => {
    expect(addWork(clock, at('2026-01-10 03:00'), 0)).toBe(at('2026-01-10 03:00'));
    expect(addWork(clock, at('2026-01-06 17:00'), -480)).toBe(
      subtractWork(clock, at('2026-01-06 17:00'), 480),
    );
  });

  it('agrees with counting minutes one at a time', () => {
    let seed = 99;
    const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const base = at('2025-12-15 00:00');
    // Count working minutes over three weeks that include the holiday and the half day.
    const span = 21 * 1440;
    const count = new Int32Array(span + 1);
    for (let m = 0; m < span; m++)
      count[m + 1] = count[m]! + (isWorking(calendar, base + m) ? 1 : 0);
    const w0 = workAt(clock, base);

    for (let round = 0; round < 2000; round++) {
      const a = Math.floor(random() * span);
      const b = Math.floor(random() * span);
      expect(workBetween(clock, base + a, base + b)).toBe(count[b]! - count[a]!);

      // snapForward lands on a working minute, with no working minute skipped.
      const forward = snapForward(clock, base + a) - base;
      if (forward < span) {
        expect(isWorking(calendar, base + forward)).toBe(true);
        expect(count[forward]).toBe(count[a]);
      }
      // snapBackward lands just after a working minute, with no working minute skipped.
      const backward = snapBackward(clock, base + a) - base;
      if (backward > 0 && count[a]! > 0) {
        expect(isWorking(calendar, base + backward - 1)).toBe(true);
        expect(count[backward]).toBe(count[a]);
      }
    }
    // The two inverses bracket every flat stretch of the work coordinate.
    for (let w = 1; w < count[span]!; w += 7) {
      const finish = finishAtWork(clock, w0 + w) - base;
      const start = startAtWork(clock, w0 + w) - base;
      expect(count[finish]).toBe(w);
      expect(count[start]).toBe(w);
      expect(isWorking(calendar, base + finish - 1)).toBe(true);
      expect(isWorking(calendar, base + start)).toBe(true);
      expect(start).toBeGreaterThanOrEqual(finish);
    }
  });

  it('handles a calendar that works all day, every day', () => {
    const allDay = parseCalendar(
      2,
      '24/7',
      1440,
      '(0||CalendarData()( (0||DaysOfWeek()( ' +
        [1, 2, 3, 4, 5, 6, 7].map((d) => `(0||${d}()( (0||0(s|00:00|f|00:00)()) ))`).join(' ') +
        ' )) ))',
    );
    expect(allDay.week[0]).toEqual([0, 1440]);
    const always = compileCalendar(allDay, day('2026-01-01'), day('2026-03-01'));
    expect(addWork(always, at('2026-01-05 08:00'), 3 * 1440)).toBe(at('2026-01-08 08:00'));
    expect(snapForward(always, at('2026-01-05 00:00'))).toBe(at('2026-01-05 00:00'));
    expect(workBetween(always, at('2026-01-05 08:00'), at('2026-01-06 09:00'))).toBe(1500);
  });

  it('refuses dates outside the prepared range and calendars with no work', () => {
    expect(() => workAt(clock, at('2030-01-01 08:00'))).toThrowError(RangeError);
    expect(() => addWork(clock, at('2026-12-30 08:00'), 100000)).toThrowError(RangeError);
    const never: Calendar = {
      ...calendar,
      week: [[], [], [], [], [], [], []],
      exceptionDays: new Int32Array(0),
      exceptionPeriods: [],
    };
    expect(() => compileCalendar(never, day('2026-01-01'), day('2026-02-01'))).toThrowError(
      RangeError,
    );
  });
});
