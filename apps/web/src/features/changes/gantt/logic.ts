/**
 * Where the relationship lines go (exploration 11, option C): the selected activity's links, its
 * driving path, and the links added or removed since update A. Pure: rows and pixels in, paths
 * out. The painter draws what this returns.
 */
import type { LogicLink } from '@slip/engine';
import { RelType } from '@slip/xer';

/** Where a visible row's bar starts and ends across the chart, and its centre line. */
export interface RowAnchor {
  /** Left and right ends in pixels, cut to the chart. Equal for a milestone. */
  x0: number;
  x1: number;
  cy: number;
  /** The bar is beyond this edge of the chart; its anchor is pinned to the edge. */
  off?: 'left' | 'right';
}

export type LineStyle = 'driving' | 'link' | 'added' | 'removed';

export interface LinePath {
  points: [number, number][];
  style: LineStyle;
  /** Words beside the line for a link that changed: "New link", "Removed". */
  label: string;
}

export interface Stub {
  /** The visible end the stub leaves from. */
  x: number;
  y: number;
  /** Which way the other ends are. `hidden`: not in this filtered view at all. */
  toward: 'above' | 'below' | 'hidden';
  count: number;
  driving: boolean;
}

export interface LogicLayout {
  lines: LinePath[];
  stubs: Stub[];
}

/** How far a line runs out of a bar before it turns. */
const OUT = 6;

const fromFinish = (type: number) => type !== RelType.SS && type !== RelType.SF;
const intoFinish = (type: number) => type === RelType.FF || type === RelType.SF;

/**
 * Lines between rows that are both on screen, and one stub per visible activity and direction
 * for links whose other end is not. `anchorOf` gives a row's bar on screen, or null when the row
 * is not drawn.
 */
export function layoutLogic(
  links: readonly LogicLink[],
  anchorOf: (row: number) => RowAnchor | null,
): LogicLayout {
  const lines: LinePath[] = [];
  const stubs = new Map<string, Stub>();

  const stub = (row: number, anchor: RowAnchor, x: number, other: number, link: LogicLink) => {
    const toward = other < 0 ? 'hidden' : other < row ? 'above' : 'below';
    const key = `${row}|${toward}`;
    const existing = stubs.get(key);
    if (existing) {
      existing.count++;
      existing.driving ||= link.driving;
    } else {
      stubs.set(key, { x, y: anchor.cy, toward, count: 1, driving: link.driving });
    }
  };

  for (const link of links) {
    const from = link.predRow >= 0 ? anchorOf(link.predRow) : null;
    const to = link.succRow >= 0 ? anchorOf(link.succRow) : null;
    const outRight = fromFinish(link.relType);
    const inFromRight = intoFinish(link.relType);
    const style: LineStyle = link.driving
      ? 'driving'
      : link.state === 'added'
        ? 'added'
        : link.state === 'removed'
          ? 'removed'
          : 'link';
    const label = link.state === 'added' ? 'New link' : link.state === 'removed' ? 'Removed' : '';

    if (from && to) {
      // Both bars beyond the same edge: a line would only run along that edge.
      if (from.off && from.off === to.off) continue;
      const startX = outRight ? from.x1 : from.x0;
      const endX = inFromRight ? to.x1 : to.x0;
      const turnX = startX + (outRight ? OUT : -OUT);
      const approachX = endX + (inFromRight ? OUT : -OUT);
      const points: [number, number][] = [
        [startX, from.cy],
        [turnX, from.cy],
      ];
      // Straight down to the successor's row when the turn lines up with its approach side;
      // otherwise down to just short of it, across, and in.
      const direct = inFromRight ? turnX >= approachX : turnX <= approachX;
      if (direct) {
        points.push([turnX, to.cy], [endX, to.cy]);
      } else {
        const short =
          to.cy + (to.cy > from.cy ? -1 : 1) * Math.min(8, Math.abs(to.cy - from.cy) / 2);
        points.push([turnX, short], [approachX, short], [approachX, to.cy], [endX, to.cy]);
      }
      lines.push({ points, style, label });
    } else if (from) {
      stub(link.predRow, from, outRight ? from.x1 + OUT : from.x0 - OUT, link.succRow, link);
    } else if (to) {
      stub(link.succRow, to, inFromRight ? to.x1 + OUT : to.x0 - OUT, link.predRow, link);
    }
  }
  // Removed links first, so the lines that are there now are drawn over them.
  const order: Record<LineStyle, number> = { removed: 0, link: 1, added: 2, driving: 3 };
  lines.sort((a, b) => order[a.style] - order[b.style]);
  return { lines, stubs: [...stubs.values()] };
}

/** The words for a stub: "2 above", "1 below", "3 not in this view". */
export function stubLabel(stub: Stub): string {
  return stub.toward === 'hidden'
    ? `${stub.count} not in this view`
    : `${stub.count} ${stub.toward}`;
}
