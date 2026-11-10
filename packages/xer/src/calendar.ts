/**
 * Calendars, and the parser for P6's `clndr_data` text.
 *
 * `clndr_data` is a nested list in which every node has the shape
 *   (0||name(key|value|key|value)(child child ...))
 * We read two branches: DaysOfWeek (the working periods for each weekday)
 * and Exceptions (dated overrides; an exception with no periods is a holiday).
 * Everything else is ignored. See docs/spec/xer-format.md for the limits.
 */
import { weekdayOfEpochDay } from './dates.ts';

/** Working periods within one day, as [startMinute, endMinute, startMinute, endMinute, ...]. */
export type DayPeriods = number[];

export interface Calendar {
  id: number;
  name: string;
  /** Minutes in a working day, from `day_hr_cnt`. Used to turn durations into working days. */
  dayMinutes: number;
  /** Index 0 is Sunday, 6 is Saturday. */
  week: DayPeriods[];
  /** Days since EPOCH with their own periods, sorted ascending. */
  exceptionDays: Int32Array;
  /** Periods for each entry in `exceptionDays`. Empty means a non-working day. */
  exceptionPeriods: DayPeriods[];
  /** False when `clndr_data` could not be read and the Monday to Friday fallback is in use. */
  parsed: boolean;
}

export interface CalendarTable {
  n: number;
  calendars: Calendar[];
  /** Index of the project's default calendar, or -1 if none is known. */
  defaultIndex: number;
}

interface Node {
  name: string;
  attrs: string;
  children: Node[];
}

/** Recursive-descent reader for the nested list. Returns null if the text does not fit the shape. */
function parseNodes(text: string): Node[] | null {
  let at = 0;

  function skipSpace(): void {
    while (at < text.length) {
      const code = text.charCodeAt(at);
      // Space, tab, CR, LF and the 0x7F separator P6 writes between nodes.
      if (code === 32 || code === 9 || code === 13 || code === 10 || code === 127) at++;
      else break;
    }
  }

  function readUntil(stop: string): string | null {
    const end = text.indexOf(stop, at);
    if (end < 0) return null;
    const value = text.slice(at, end);
    at = end + stop.length;
    return value;
  }

  function node(depth: number): Node | null {
    if (depth > 16) return null;
    if (text.charCodeAt(at) !== 40) return null; // (
    at++;
    if (readUntil('||') === null) return null;
    const name = readUntil('(');
    if (name === null) return null;
    const attrs = readUntil(')');
    if (attrs === null) return null;
    skipSpace();
    if (text.charCodeAt(at) !== 40) return null;
    at++;
    const children = list(depth + 1);
    if (children === null) return null;
    if (text.charCodeAt(at) !== 41) return null; // )
    at++;
    skipSpace();
    if (text.charCodeAt(at) !== 41) return null;
    at++;
    return { name: name.trim(), attrs, children };
  }

  function list(depth: number): Node[] | null {
    const nodes: Node[] = [];
    skipSpace();
    while (at < text.length && text.charCodeAt(at) === 40) {
      const child = node(depth);
      if (child === null) return null;
      nodes.push(child);
      skipSpace();
    }
    return nodes;
  }

  const nodes = list(0);
  skipSpace();
  return nodes !== null && at === text.length ? nodes : null;
}

function find(nodes: Node[], name: string): Node | undefined {
  for (const candidate of nodes) {
    if (candidate.name === name) return candidate;
    const inner = find(candidate.children, name);
    if (inner) return inner;
  }
  return undefined;
}

function attr(attrs: string, key: string): string | undefined {
  const parts = attrs.split('|');
  for (let i = 0; i + 1 < parts.length; i += 2) {
    if (parts[i] === key) return parts[i + 1];
  }
  return undefined;
}

function clockMinutes(text: string | undefined): number {
  if (!text) return -1;
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return -1;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes <= 1440 ? minutes : -1;
}

/** Reads the (s|08:00|f|16:00) children of a day into sorted, merged periods. */
function periodsOf(day: Node): DayPeriods {
  const spans: [number, number][] = [];
  for (const child of day.children) {
    let start = clockMinutes(attr(child.attrs, 's'));
    let finish = clockMinutes(attr(child.attrs, 'f'));
    if (start < 0 || finish < 0) continue;
    // "00:00" as a finish means the end of the day.
    if (finish === 0 && start > 0) finish = 1440;
    if (finish < start) [start, finish] = [finish, start];
    if (finish > start) spans.push([start, finish]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: DayPeriods = [];
  for (const [start, finish] of spans) {
    const last = merged.length - 1;
    if (last >= 1 && start <= merged[last]!) merged[last] = Math.max(merged[last]!, finish);
    else merged.push(start, finish);
  }
  return merged;
}

/** Excel-style day serial (day 1 is 1900-01-01, with the 1900 leap-year quirk) for 2000-01-01. */
const SERIAL_OF_EPOCH = 36526;

/** Monday to Friday, one block of `dayMinutes` starting at 08:00. */
export function fallbackWeek(dayMinutes: number): DayPeriods[] {
  const start = 8 * 60;
  const finish = Math.min(1440, start + dayMinutes);
  const working: DayPeriods = finish > start ? [start, finish] : [];
  return [[], working, working, working, working, working, []];
}

export function parseCalendar(
  id: number,
  name: string,
  dayMinutes: number,
  clndrData: string,
): Calendar {
  const fallback: Calendar = {
    id,
    name,
    dayMinutes,
    week: fallbackWeek(dayMinutes),
    exceptionDays: new Int32Array(0),
    exceptionPeriods: [],
    parsed: false,
  };

  const nodes = clndrData === '' ? null : parseNodes(clndrData);
  if (nodes === null) return fallback;
  const daysOfWeek = find(nodes, 'DaysOfWeek');
  if (!daysOfWeek) return fallback;

  const week: DayPeriods[] = [[], [], [], [], [], [], []];
  let seen = 0;
  for (const day of daysOfWeek.children) {
    // P6 numbers the days 1 (Sunday) to 7 (Saturday).
    const number = Number(day.name);
    if (!Number.isInteger(number) || number < 1 || number > 7) continue;
    week[number - 1] = periodsOf(day);
    seen++;
  }
  if (seen === 0) return fallback;

  const exceptions = new Map<number, DayPeriods>();
  const exceptionNode = find(nodes, 'Exceptions');
  for (const entry of exceptionNode?.children ?? []) {
    const serial = Number(attr(entry.attrs, 'd'));
    if (!Number.isInteger(serial)) continue;
    exceptions.set(serial - SERIAL_OF_EPOCH, periodsOf(entry));
  }
  const exceptionDays = Int32Array.from([...exceptions.keys()].sort((a, b) => a - b));

  return {
    id,
    name,
    dayMinutes,
    week,
    exceptionDays,
    exceptionPeriods: Array.from(exceptionDays, (day) => exceptions.get(day)!),
    parsed: true,
  };
}

/** The working periods that apply on a given day since EPOCH: an exception if one exists, else the weekday's. */
export function periodsOn(calendar: Calendar, day: number): DayPeriods {
  const days = calendar.exceptionDays;
  let low = 0;
  let high = days.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const value = days[middle]!;
    if (value === day) return calendar.exceptionPeriods[middle]!;
    if (value < day) low = middle + 1;
    else high = middle - 1;
  }
  return calendar.week[weekdayOfEpochDay(day)]!;
}
