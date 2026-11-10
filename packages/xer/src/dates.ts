/**
 * Wall-clock date arithmetic for XER dates (decision D13).
 *
 * XER dates look like "2026-03-14 08:00" and carry no timezone. They are
 * stored as whole minutes since EPOCH, worked out by calendar arithmetic.
 * The built-in date object is never used: it would apply the machine's
 * timezone and shift values around daylight saving changes.
 */

/** "No value" marker for every Int32 date, duration and float column. */
export const NONE = -2147483648;

/** The wall-clock moment that minute 0 stands for. Fixed, so two files always share it. */
export const EPOCH = '2000-01-01T00:00';

export const MINUTES_PER_DAY = 1440;

/** Days from 1970-01-01 to the given civil date (proleptic Gregorian). */
export function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** The inverse of daysFromCivil. */
export function civilFromDays(days: number): { year: number; month: number; day: number } {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

const EPOCH_DAYS = daysFromCivil(2000, 1, 1);

/** Whole days since EPOCH for a civil date. */
export function epochDay(year: number, month: number, day: number): number {
  return daysFromCivil(year, month, day) - EPOCH_DAYS;
}

/** Day of the week for a day number since EPOCH: 0 is Sunday, 6 is Saturday. */
export function weekdayOfEpochDay(day: number): number {
  // 2000-01-01 was a Saturday.
  return (((day + 6) % 7) + 7) % 7;
}

/** Reads `count` decimal digits starting at `at`, or -1 if any is not a digit. */
function digits(text: string, at: number, count: number): number {
  let value = 0;
  for (let i = at; i < at + count; i++) {
    const code = text.charCodeAt(i) - 48;
    if (!(code >= 0 && code <= 9)) return -1;
    value = value * 10 + code;
  }
  return value;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Parses "yyyy-mm-dd hh:mm" (seconds, if present, are ignored) or
 * "yyyy-mm-dd" into minutes since EPOCH. Returns NONE for an empty or
 * malformed value; callers that care tell the two apart by checking for "".
 */
export function parseXerDate(text: string): number {
  if (text.length < 10) return NONE;
  const year = digits(text, 0, 4);
  const month = digits(text, 5, 2);
  const day = digits(text, 8, 2);
  if (year < 0 || month < 1 || month > 12 || day < 1) return NONE;
  if (text.charCodeAt(4) !== 45 || text.charCodeAt(7) !== 45) return NONE;
  const monthLength = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1]!;
  if (day > monthLength) return NONE;

  let hour = 0;
  let minute = 0;
  if (text.length >= 16) {
    hour = digits(text, 11, 2);
    minute = digits(text, 14, 2);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return NONE;
  } else if (text.length !== 10) {
    return NONE;
  }
  return epochDay(year, month, day) * MINUTES_PER_DAY + hour * 60 + minute;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/** Formats minutes since EPOCH as "yyyy-mm-dd hh:mm". NONE gives "". */
export function formatXerDate(minutes: number): string {
  if (minutes === NONE) return '';
  const day = Math.floor(minutes / MINUTES_PER_DAY);
  const rest = minutes - day * MINUTES_PER_DAY;
  const civil = civilFromDays(day + EPOCH_DAYS);
  return `${pad(civil.year, 4)}-${pad(civil.month, 2)}-${pad(civil.day, 2)} ${pad(Math.floor(rest / 60), 2)}:${pad(rest % 60, 2)}`;
}

/** Converts an XER hour count ("8", "12.5", "-16") to whole minutes. Empty or malformed gives NONE. */
export function parseHoursAsMinutes(text: string): number {
  if (text === '') return NONE;
  const hours = Number(text);
  return Number.isFinite(hours) ? Math.round(hours * 60) : NONE;
}
