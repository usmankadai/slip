/**
 * Working-time arithmetic on a calendar.
 *
 * Every question ("what is 5 working days after this moment?", "how much
 * float is between these two dates?") is answered through one idea: the
 * work coordinate W(t), the number of working minutes on the calendar
 * before wall-clock minute t. W never decreases, and it is flat across
 * nights, weekends and holidays.
 *
 * A WorkClock stores W at the start of every day in a range, so W(t) is a
 * lookup plus a walk over one day's periods, and the inverse is a binary
 * search. Nothing here loops day by day, which matters at a million
 * activities.
 */
import { MINUTES_PER_DAY, periodsOn, type Calendar, type DayPeriods } from '@slip/xer';

export interface WorkClock {
  calendar: Calendar;
  /** First day covered, in days since EPOCH. */
  fromDay: number;
  /** One past the last day covered. */
  toDay: number;
  /** cumulative[d] is the working minutes before day (fromDay + d). Length is the day count plus one. */
  cumulative: Int32Array;
}

function dayTotal(periods: DayPeriods): number {
  let total = 0;
  for (let i = 0; i < periods.length; i += 2) total += periods[i + 1]! - periods[i]!;
  return total;
}

/** Working minutes in a day before the given minute of that day. */
function workedBefore(periods: DayPeriods, minuteOfDay: number): number {
  let total = 0;
  for (let i = 0; i < periods.length; i += 2) {
    const start = periods[i]!;
    if (minuteOfDay <= start) break;
    total += Math.min(minuteOfDay, periods[i + 1]!) - start;
  }
  return total;
}

/** Prepares a calendar for fast arithmetic over [fromDay, toDay). Throws if it has no working time there. */
export function compileCalendar(calendar: Calendar, fromDay: number, toDay: number): WorkClock {
  const days = toDay - fromDay;
  const cumulative = new Int32Array(days + 1);
  for (let d = 0; d < days; d++) {
    cumulative[d + 1] = cumulative[d]! + dayTotal(periodsOn(calendar, fromDay + d));
  }
  if (cumulative[days] === 0) {
    throw new RangeError(`Calendar "${calendar.name}" has no working time.`);
  }
  return { calendar, fromDay, toDay, cumulative };
}

function outOfRange(): never {
  throw new RangeError('Date is outside the range this calendar was prepared for.');
}

/** W(t): working minutes on the calendar before wall-clock minute t. */
export function workAt(clock: WorkClock, t: number): number {
  const day = Math.floor(t / MINUTES_PER_DAY);
  const index = day - clock.fromDay;
  if (index < 0 || index >= clock.toDay - clock.fromDay) outOfRange();
  return (
    clock.cumulative[index]! +
    workedBefore(periodsOn(clock.calendar, day), t - day * MINUTES_PER_DAY)
  );
}

/** Largest index i with cumulative[i] <= w (or < w when `strict`). */
function lastDayAtOrBelow(clock: WorkClock, w: number, strict: boolean): number {
  const cumulative = clock.cumulative;
  let low = 0;
  let high = cumulative.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const value = cumulative[middle]!;
    if (strict ? value < w : value <= w) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

/**
 * The earliest moment whose work coordinate is w: the instant the w-th
 * working minute finishes. Used for finishes, so 8 hours of work that starts
 * at 08:00 ends at 17:00 the same day, not 08:00 the next.
 */
export function finishAtWork(clock: WorkClock, w: number): number {
  const index = lastDayAtOrBelow(clock, w, true);
  if (index < 0 || index >= clock.cumulative.length - 1) outOfRange();
  const day = clock.fromDay + index;
  const periods = periodsOn(clock.calendar, day);
  let rest = w - clock.cumulative[index]!;
  for (let i = 0; i < periods.length; i += 2) {
    const length = periods[i + 1]! - periods[i]!;
    if (rest <= length) return day * MINUTES_PER_DAY + periods[i]! + rest;
    rest -= length;
  }
  return outOfRange();
}

/**
 * The latest moment whose work coordinate is w: the instant the next working
 * minute begins. Used for starts, so work that follows a 17:00 finish starts
 * at 08:00 on the next working day.
 */
export function startAtWork(clock: WorkClock, w: number): number {
  const index = lastDayAtOrBelow(clock, w, false);
  if (index < 0 || index >= clock.cumulative.length - 1) outOfRange();
  const day = clock.fromDay + index;
  const periods = periodsOn(clock.calendar, day);
  let rest = w - clock.cumulative[index]!;
  for (let i = 0; i < periods.length; i += 2) {
    const length = periods[i + 1]! - periods[i]!;
    if (rest < length) return day * MINUTES_PER_DAY + periods[i]! + rest;
    rest -= length;
  }
  return outOfRange();
}

/** t itself if work can start then, otherwise the start of the next working period. */
export function snapForward(clock: WorkClock, t: number): number {
  return startAtWork(clock, workAt(clock, t));
}

/** t itself if work can finish then, otherwise the end of the previous working period. */
export function snapBackward(clock: WorkClock, t: number): number {
  return finishAtWork(clock, workAt(clock, t));
}

/** The finish of `minutes` of work that starts at t. Zero minutes returns t unchanged. */
export function addWork(clock: WorkClock, t: number, minutes: number): number {
  if (minutes === 0) return t;
  if (minutes < 0) return subtractWork(clock, t, -minutes);
  return finishAtWork(clock, workAt(clock, t) + minutes);
}

/** The start of `minutes` of work that finishes at t. Zero minutes returns t unchanged. */
export function subtractWork(clock: WorkClock, t: number, minutes: number): number {
  if (minutes === 0) return t;
  if (minutes < 0) return addWork(clock, t, -minutes);
  return startAtWork(clock, workAt(clock, t) - minutes);
}

/** Working minutes from a to b. Negative when b is before a. */
export function workBetween(clock: WorkClock, a: number, b: number): number {
  return workAt(clock, b) - workAt(clock, a);
}
