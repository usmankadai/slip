import { describe, expect, it } from 'vitest';
import { Change } from '@slip/engine';
import {
  COLUMNS,
  DEFAULT_FILTER,
  DEFAULT_SORT,
  changeWords,
  engineFilter,
  nextSort,
  scrollReadout,
  statusLine,
} from './model.ts';
import {
  MAX_SCROLL_HEIGHT,
  fetchRange,
  firstRowAt,
  firstRowToReveal,
  rowsInView,
  scrollHeight,
  scrollTopFor,
  wholeRowsInView,
  windowAt,
} from './virtual.ts';

describe('windowing, below the height cap', () => {
  const viewport = { total: 4812, rowHeight: 24, height: 600 };

  it('scrolls a pixel of rows per pixel', () => {
    expect(scrollHeight(viewport)).toBe(4812 * 24);
    expect(firstRowAt(0, viewport)).toBe(0);
    expect(firstRowAt(2400, viewport)).toBeCloseTo(100, 6);
    expect(scrollTopFor(100, viewport)).toBeCloseTo(2400, 6);
  });

  it('draws the rows in view plus one, and says how far the first is scrolled off', () => {
    expect(rowsInView(viewport)).toBe(25);
    expect(windowAt(2412, viewport)).toEqual({
      start: 100,
      end: 126,
      offset: expect.closeTo(12, 6),
    });
  });

  it('stops at the last row', () => {
    const end = scrollHeight(viewport) - viewport.height;
    const window = windowAt(end, viewport);
    expect(window.end).toBe(4812);
    expect(window.start).toBe(4812 - 25);
    expect(windowAt(end + 5000, viewport)).toEqual(window);
  });
});

describe('windowing, above the height cap', () => {
  const viewport = { total: 1_000_000, rowHeight: 24, height: 600 };

  it('never asks the browser for more than the cap', () => {
    expect(scrollHeight(viewport)).toBe(MAX_SCROLL_HEIGHT);
  });

  it('reaches the first and the last row', () => {
    expect(windowAt(0, viewport).start).toBe(0);
    expect(windowAt(MAX_SCROLL_HEIGHT - viewport.height, viewport).end).toBe(1_000_000);
  });

  it('goes to a row and comes back to the same row', () => {
    for (const row of [0, 1, 12_345, 500_000, 999_975]) {
      expect(firstRowAt(scrollTopFor(row, viewport), viewport)).toBeCloseTo(row, 3);
    }
  });
});

describe('windowing, edge cases', () => {
  it('handles a list shorter than the view, and an empty one', () => {
    const short = { total: 12, rowHeight: 24, height: 600 };
    expect(windowAt(300, short)).toEqual({ start: 0, end: 12, offset: 0 });
    expect(scrollTopFor(5, short)).toBe(0);
    expect(windowAt(0, { total: 0, rowHeight: 24, height: 600 })).toEqual({
      start: 0,
      end: 0,
      offset: 0,
    });
  });

  it('survives a view with no height yet', () => {
    expect(windowAt(0, { total: 100, rowHeight: 24, height: 0 })).toMatchObject({ start: 0 });
  });

  it('reveals a row with the least movement', () => {
    const viewport = { total: 1000, rowHeight: 24, height: 600 };
    expect(firstRowToReveal(110, 100, viewport)).toBe(100);
    expect(firstRowToReveal(90, 100, viewport)).toBe(90);
    expect(firstRowToReveal(125, 100, viewport)).toBe(101);
  });

  it('asks for rows either side of the window, inside the list', () => {
    expect(fetchRange({ start: 100, end: 126, offset: 0 }, 4812)).toEqual([40, 186]);
    expect(fetchRange({ start: 0, end: 12, offset: 0 }, 12)).toEqual([0, 12]);
  });
});

describe('rows wholly in view', () => {
  const viewport = { total: 5855, rowHeight: 24, height: 610 };

  it('counts only whole rows at the top', () => {
    expect(wholeRowsInView(0, viewport)).toEqual({ first: 1, last: 25 });
  });

  it('ends on the last row when scrolled to the end', () => {
    const end = scrollHeight(viewport) - viewport.height;
    expect(wholeRowsInView(end, viewport)).toEqual({ first: 5831, last: 5855 });
  });

  it('handles a short list and an empty one', () => {
    expect(wholeRowsInView(0, { total: 12, rowHeight: 24, height: 610 })).toEqual({
      first: 1,
      last: 12,
    });
    expect(wholeRowsInView(0, { total: 0, rowHeight: 24, height: 610 })).toEqual({
      first: 0,
      last: 0,
    });
    expect(wholeRowsInView(0, { total: 3, rowHeight: 24, height: 0 })).toEqual({
      first: 1,
      last: 1,
    });
  });
});

describe('filter and sort', () => {
  it('shows changed activities by default, largest finish slip first', () => {
    expect(engineFilter(DEFAULT_FILTER)).toEqual({ changedOnly: true });
    expect(DEFAULT_SORT).toEqual({ column: 'finishDeltaDays', direction: 'desc' });
  });

  it('turns a kind and a search into an engine filter', () => {
    expect(engineFilter({ kind: 'logic', text: '  TRK ' })).toEqual({
      flagsAny: Change.LogicChanged,
      text: 'TRK',
    });
    expect(engineFilter({ kind: null, text: '' })).toEqual({});
    expect(engineFilter({ kind: 'dates', text: '' }).flagsAny).toBe(
      Change.StartMoved | Change.FinishMoved,
    );
  });

  it('can show only the activities counted against a health check', () => {
    expect(engineFilter({ kind: null, text: '', healthCheck: 7 })).toEqual({ healthCheck: 7 });
    expect(engineFilter({ kind: 'dates', text: '', healthCheck: 7 }).healthCheck).toBe(7);
    expect(engineFilter({ kind: null, text: '', healthCheck: 1.5 })).toEqual({});
  });

  it('cuts a very long search', () => {
    expect(engineFilter({ kind: null, text: 'x'.repeat(5000) }).text).toHaveLength(200);
  });

  it('reverses a sorted column, and sorts a new numeric column largest first', () => {
    const slip = COLUMNS.find((column) => column.id === 'slip')!;
    const code = COLUMNS.find((column) => column.id === 'code')!;
    const changes = COLUMNS.find((column) => column.id === 'changes')!;
    expect(nextSort(DEFAULT_SORT, slip)).toEqual({ column: 'finishDeltaDays', direction: 'asc' });
    expect(nextSort(DEFAULT_SORT, code)).toEqual({ column: 'code', direction: 'asc' });
    expect(nextSort(null, slip)).toEqual({ column: 'finishDeltaDays', direction: 'desc' });
    expect(nextSort(DEFAULT_SORT, changes)).toBe(DEFAULT_SORT);
  });
});

describe('words', () => {
  it('names the changes on an activity in a fixed order', () => {
    expect(changeWords(Change.LogicChanged | Change.FinishMoved | Change.StartMoved)).toBe(
      'Dates, Logic',
    );
    expect(changeWords(Change.Added)).toBe('Added');
    expect(changeWords(0)).toBe('');
    expect(changeWords(Number.NaN)).toBe('');
  });

  it('says which rows are on screen and how many are hidden', () => {
    expect(statusLine({ first: 1201, last: 1225, total: 4812, unfiltered: 350_412 })).toEqual({
      where: 'Rows 1,201 to 1,225 of 4,812',
      hidden: '345,600 activities hidden by the filter',
    });
    expect(statusLine({ first: 1, last: 25, total: 350_412, unfiltered: 350_412 }).hidden).toBe(
      'Nothing hidden',
    );
    expect(statusLine({ first: 0, last: 0, total: 0, unfiltered: 350_412 }).where).toBe('No rows');
    expect(statusLine({ first: 1, last: 1, total: 1, unfiltered: 2 })).toEqual({
      where: 'Row 1 of 1',
      hidden: '1 activity hidden by the filter',
    });
  });

  it('gives the scrolling readout in rows', () => {
    expect(scrollReadout(120_401, 350_412)).toBe('Row 120,401 of 350,412');
  });
});
