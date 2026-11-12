/** The Gantt's time axis. Pure, and free of the built-in date object (D13). */
import { MINUTES_PER_DAY, civilFromDays, daysFromCivil } from '@slip/xer';

export type Zoom = 'weeks' | 'months' | 'years';

/** Pixels for one calendar day at each zoom. */
export const PX_PER_DAY: Record<Zoom, number> = { weeks: 8, months: 2, years: 0.4 };

export interface TimeScale {
  /** The moment at the left edge, in minutes since the epoch. */
  origin: number;
  pxPerDay: number;
}

/** Horizontal position of a moment, in pixels from the left edge. */
export function xOf(minutes: number, scale: TimeScale): number {
  return ((minutes - scale.origin) / MINUTES_PER_DAY) * scale.pxPerDay;
}

/** The moment at a horizontal position. */
export function timeAt(x: number, scale: TimeScale): number {
  return scale.origin + (x / scale.pxPerDay) * MINUTES_PER_DAY;
}

/** The origin that puts a moment at a given fraction of the way across the view. */
export function originFor(
  minutes: number,
  fraction: number,
  width: number,
  pxPerDay: number,
): number {
  return Math.round(minutes - ((width * fraction) / pxPerDay) * MINUTES_PER_DAY);
}

const EPOCH_DAYS = daysFromCivil(2000, 1, 1);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Tick {
  x: number;
  /** '' for a tick with a line but no room for a label. */
  label: string;
  /** True at the start of a year, drawn heavier. */
  major: boolean;
}

/**
 * Month starts across the view, labelled as often as there is room for: every
 * month, every quarter, or every year.
 */
export function ticks(scale: TimeScale, width: number): Tick[] {
  if (!(width > 0) || !(scale.pxPerDay > 0)) return [];
  const firstDay = Math.floor(scale.origin / MINUTES_PER_DAY);
  const lastDay = Math.ceil(timeAt(width, scale) / MINUTES_PER_DAY);
  const monthWidth = scale.pxPerDay * 30;
  const every = monthWidth >= 48 ? 1 : monthWidth * 3 >= 48 ? 3 : 12;
  let { year, month } = civilFromDays(firstDay + EPOCH_DAYS);
  const out: Tick[] = [];
  // A view never spans more than a few hundred months; the bound guards against a bad scale.
  for (let guard = 0; guard < 2400; guard++) {
    const day = daysFromCivil(year, month, 1) - EPOCH_DAYS;
    if (day > lastDay) break;
    const x = xOf(day * MINUTES_PER_DAY, scale);
    if (x >= -monthWidth) {
      const labelled = (month - 1) % every === 0;
      const text = month === 1 || every === 12 ? String(year) : MONTHS[month - 1]!;
      if (every < 12 || month === 1) {
        out.push({ x, label: labelled ? text : '', major: month === 1 });
      }
    }
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return out;
}

/** Space left before the earliest bar when the axis is fitted or a bar is brought into view. */
const LEAD = 0.1;

/**
 * The origin that brings the earliest of some bars into view near the left edge, or null
 * when none of them has a date. Used once when rows first arrive, and on request.
 */
export function originToFit(
  starts: readonly number[],
  width: number,
  pxPerDay: number,
  none: number,
): number | null {
  let earliest = Infinity;
  for (const start of starts) if (start !== none && start < earliest) earliest = start;
  return Number.isFinite(earliest) ? originFor(earliest, LEAD, width, pxPerDay) : null;
}

/**
 * The origin that shows a bar, moving only if it has to: unchanged when the bar's start is
 * already in view, otherwise the start is placed near the left edge.
 */
export function originToReveal(
  start: number,
  finish: number,
  scale: TimeScale,
  width: number,
): number {
  const x0 = xOf(start, scale);
  const x1 = xOf(finish, scale);
  const startInView = x0 >= 0 && x0 <= width * (1 - LEAD);
  const spansView = x0 < 0 && x1 > width;
  return startInView || spansView ? scale.origin : originFor(start, LEAD, width, scale.pxPerDay);
}
