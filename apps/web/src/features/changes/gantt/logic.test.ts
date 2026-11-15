import { describe, expect, it } from 'vitest';
import type { LogicLink } from '@slip/engine';
import { RelType } from '@slip/xer';
import { layoutLogic, stubLabel, type RowAnchor } from './logic.ts';

// Rows 10 to 14 are on screen, 24px apart; each bar runs from 100 + 10*row to 150 + 10*row.
const anchorOf = (row: number): RowAnchor | null =>
  row >= 10 && row <= 14
    ? { x0: 100 + 10 * row, x1: 150 + 10 * row, cy: 24 * (row - 10) + 12 }
    : null;
const link = (over: Partial<LogicLink>): LogicLink => ({
  pred: 1,
  succ: 2,
  predRow: 10,
  succRow: 12,
  relType: RelType.FS,
  state: 'kept',
  driving: false,
  ...over,
});

describe('relationship lines', () => {
  it('runs finish to start: out of the finish, down, and into the start', () => {
    // Predecessor ends at 250; successor starts at 220, behind it, so the line doubles back.
    const { lines } = layoutLogic([link({})], anchorOf);
    expect(lines[0]!.points[0]).toEqual([250, 12]);
    expect(lines[0]!.points.at(-1)).toEqual([220, 60]);
    expect(lines[0]!.style).toBe('link');
  });

  it('goes straight down when the successor starts after the turn', () => {
    const wide = (row: number): RowAnchor | null =>
      row === 1 ? { x0: 10, x1: 50, cy: 12 } : row === 2 ? { x0: 80, x1: 120, cy: 60 } : null;
    const { lines } = layoutLogic([link({ predRow: 1, succRow: 2 })], wide);
    expect(lines[0]!.points).toEqual([
      [50, 12],
      [56, 12],
      [56, 60],
      [80, 60],
    ]);
  });

  it('doubles back above the successor when its start is behind the turn', () => {
    const { lines } = layoutLogic(
      [link({ predRow: 14, succRow: 10, relType: RelType.SS })],
      anchorOf,
    );
    expect(lines[0]!.points).toEqual([
      [240, 108],
      [234, 108],
      [234, 20],
      [194, 20],
      [194, 12],
      [200, 12],
    ]);
  });

  it('enters a finish to finish successor from the right', () => {
    const { lines } = layoutLogic([link({ relType: RelType.FF, succRow: 11 })], anchorOf);
    expect(lines[0]!.points.at(-1)).toEqual([260, 36]);
  });

  it('names the style and the change, and draws removed links under the rest', () => {
    const { lines } = layoutLogic(
      [
        link({ driving: true }),
        link({ state: 'removed', succRow: 13 }),
        link({ state: 'added', succRow: 14 }),
      ],
      anchorOf,
    );
    expect(lines.map((line) => [line.style, line.label])).toEqual([
      ['removed', 'Removed'],
      ['added', 'New link'],
      ['driving', ''],
    ]);
  });

  it('gathers links that leave the screen into one stub per direction, with words', () => {
    const { lines, stubs } = layoutLogic(
      [
        link({ predRow: 3, succRow: 12 }),
        link({ predRow: 5, succRow: 12, driving: true }),
        link({ predRow: 12, succRow: 900 }),
        link({ predRow: -1, succRow: 12 }),
      ],
      anchorOf,
    );
    expect(lines).toHaveLength(0);
    expect(stubs.map((stub) => [stubLabel(stub), stub.driving])).toEqual([
      ['2 above', true],
      ['1 below', false],
      ['1 not in this view', false],
    ]);
  });

  it('leaves out a line between two bars beyond the same edge of the chart', () => {
    const off = (row: number): RowAnchor | null =>
      row === 1 || row === 2
        ? { x0: 600, x1: 600, cy: row * 24, off: 'right' }
        : row === 3
          ? { x0: 0, x1: 0, cy: 72, off: 'left' }
          : null;
    expect(layoutLogic([link({ predRow: 1, succRow: 2 })], off).lines).toHaveLength(0);
    expect(layoutLogic([link({ predRow: 3, succRow: 2 })], off).lines).toHaveLength(1);
  });

  it('draws nothing for a link with neither end on screen', () => {
    expect(layoutLogic([link({ predRow: 1, succRow: 2 })], anchorOf)).toEqual({
      lines: [],
      stubs: [],
    });
  });
});
