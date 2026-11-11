/** Words and numbers for the import screen. Dates are wall-clock integers (D13); no Date object is used. */
import { formatXerDate } from '@slip/xer';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function count(value: number): string {
  return value.toLocaleString('en-GB');
}

export function plural(value: number, word: string, many = `${word}s`): string {
  return `${count(value)} ${value === 1 ? word : many}`;
}

/** "1 June 2026" from minutes since the epoch, or "no data date" when the file has none. */
export function longDate(minutes: number): string {
  const text = formatXerDate(minutes);
  if (text === '') return 'no data date';
  const year = text.slice(0, 4);
  const month = MONTHS[Number(text.slice(5, 7)) - 1] ?? '';
  return `${Number(text.slice(8, 10))} ${month} ${year}`;
}

/** Whole megabytes, with one decimal place under 10 MB so a small file does not read as 0. */
export function megabytes(bytes: number): string {
  const value = bytes / 1_000_000;
  return value < 10 ? value.toFixed(1) : Math.round(value).toLocaleString('en-GB');
}

/** "0.02%" of a total, or "under 0.01%" when it would round to nothing. */
export function share(part: number, total: number): string {
  const percent = (part / total) * 100;
  return percent < 0.01 ? 'under 0.01%' : `${percent.toFixed(2)}%`;
}

/** "one month apart", "12 days apart". Calendar days between two data dates. */
export function apart(earlier: number, later: number): string {
  const days = Math.round(Math.abs(later - earlier) / (24 * 60));
  if (days >= 27 && days <= 32) return 'one month apart';
  return `${plural(days, 'day')} apart`;
}
