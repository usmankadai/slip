/**
 * Windowing maths for the grid. Pure: no DOM.
 *
 * A browser will not lay out an element of unlimited height, and a million
 * rows at 24px is past what some allow. So the scrolling element is never
 * taller than MAX_SCROLL_HEIGHT. Below that, a pixel of scroll is a pixel of
 * rows. Above it, the scroll position is read as a fraction of the way through
 * the list, and the visible rows are placed from that.
 */

/** Kept well under the tallest element any current browser lays out. */
export const MAX_SCROLL_HEIGHT = 8_000_000;

export interface Viewport {
  /** Rows in the view. */
  total: number;
  rowHeight: number;
  /** Height of the area rows are drawn in, in pixels. */
  height: number;
}

/** Height of the scrolling content. */
export function scrollHeight({ total, rowHeight }: Viewport): number {
  return Math.min(total * rowHeight, MAX_SCROLL_HEIGHT);
}

/** How many rows fit, counting a row that is only partly in view. */
export function rowsInView({ rowHeight, height }: Viewport): number {
  return Math.max(1, Math.ceil(height / rowHeight));
}

/** The furthest the list can scroll, in rows. May be a fraction. */
function maxFirstRow(viewport: Viewport): number {
  return Math.max(0, viewport.total - viewport.height / viewport.rowHeight);
}

/** The row at the top of the view for a scroll position. A fraction means it is part scrolled off. */
export function firstRowAt(scrollTop: number, viewport: Viewport): number {
  const range = scrollHeight(viewport) - viewport.height;
  if (range <= 0) return 0;
  const fraction = Math.min(Math.max(scrollTop / range, 0), 1);
  return fraction * maxFirstRow(viewport);
}

/** The scroll position that puts a row at the top of the view. */
export function scrollTopFor(firstRow: number, viewport: Viewport): number {
  const most = maxFirstRow(viewport);
  if (most <= 0) return 0;
  const range = scrollHeight(viewport) - viewport.height;
  return (Math.min(Math.max(firstRow, 0), most) / most) * range;
}

export interface Window {
  /** First row to draw, and one past the last. */
  start: number;
  end: number;
  /** How far the first drawn row is scrolled above the top edge, in pixels. */
  offset: number;
}

/** The rows to draw for a scroll position. */
export function windowAt(scrollTop: number, viewport: Viewport): Window {
  const first = firstRowAt(scrollTop, viewport);
  const start = Math.floor(first);
  return {
    start,
    end: Math.min(viewport.total, start + rowsInView(viewport) + 1),
    offset: (first - start) * viewport.rowHeight,
  };
}

/**
 * The top row that brings `row` into view with the least movement: unchanged if it is
 * already wholly visible, otherwise just enough to show it.
 */
export function firstRowToReveal(row: number, currentFirst: number, viewport: Viewport): number {
  const whole = Math.max(1, Math.floor(viewport.height / viewport.rowHeight));
  if (row < currentFirst) return row;
  if (row > currentFirst + whole - 1) return row - whole + 1;
  return currentFirst;
}

/** The range to ask the engine for: the window plus rows either side, so a short scroll needs no request. */
export function fetchRange(window: Window, total: number, overscan = 60): [number, number] {
  return [Math.max(0, window.start - overscan), Math.min(total, window.end + overscan)];
}

/** The first and last rows that are wholly in view, 1-based, or zeros for an empty list. */
export function wholeRowsInView(
  scrollTop: number,
  viewport: Viewport,
): { first: number; last: number } {
  if (viewport.total === 0) return { first: 0, last: 0 };
  const top = firstRowAt(scrollTop, viewport);
  const first = Math.min(viewport.total, Math.ceil(top - 1e-6) + 1);
  const last = Math.min(
    viewport.total,
    Math.floor(top + viewport.height / viewport.rowHeight + 1e-6),
  );
  return { first, last: Math.max(first, last) };
}
