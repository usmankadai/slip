import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { MINUTES_PER_DAY } from '@slip/xer';
import { count, longDate } from '../../../shared/format.ts';
import styles from '../changes.module.css';
import type { GanttRow } from './geometry.ts';
import { paintGantt, readTheme, type GanttTheme } from './paint.ts';
import { timeAt, type TimeScale } from './scale.ts';

export interface GanttProps {
  rowHeight: number;
  /** Position in the view of the first row drawn, and how far it is scrolled off the top. */
  firstRow: number;
  offset: number;
  /** One entry per row drawn, in the same order as the grid's rows. */
  rows: (GanttRow | undefined)[];
  /** Rows in the view, for the description. */
  total: number;
  selectedRow: number | null;
  onSelectRow: (row: number) => void;
  scale: TimeScale;
  /** Called with a new origin when the planner drags or scrolls the time axis. */
  onPan: (origin: number) => void;
  dataDate: number;
  /** Vertical wheel movement over the chart, handed to the grid so the two scroll as one. */
  onScrollRows: (deltaY: number) => void;
  /** The grid's key handling, so arrow keys work here too. */
  onKeyDown: (event: KeyboardEvent) => void;
  /** Told the chart's width in pixels once it is known, and when it changes. */
  onWidth?: (width: number) => void;
}

/**
 * The Gantt for the rows the grid is showing. It has no scroll position of its own
 * down the page: it draws exactly the grid's rows, so the two cannot drift apart.
 * A canvas is invisible to assistive technology; every date drawn here is text in the grid.
 */
export function Gantt({
  rowHeight,
  firstRow,
  offset,
  rows,
  total,
  selectedRow,
  onSelectRow,
  scale,
  onPan,
  dataDate,
  onScrollRows,
  onKeyDown,
  onWidth,
}: GanttProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ratio, setRatio] = useState(1);
  const theme = useRef<GanttTheme | null>(null);
  const drag = useRef<{ x: number; origin: number; moved: boolean } | null>(null);

  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    theme.current = readTheme(element);
    const measure = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
      setRatio(globalThis.devicePixelRatio || 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // Moving to another monitor or zooming the browser changes the pixel ratio without a resize.
    const query = matchMedia(`(resolution: ${globalThis.devicePixelRatio || 1}dppx)`);
    query.addEventListener('change', measure);
    return () => {
      observer.disconnect();
      query.removeEventListener('change', measure);
    };
  }, [ratio]);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context || !theme.current || size.width === 0) return;
    const width = Math.round(size.width * ratio);
    const height = Math.round(size.height * ratio);
    if (element.width !== width) element.width = width;
    if (element.height !== height) element.height = height;
    const frame = requestAnimationFrame(() =>
      paintGantt(
        context,
        { ...size, ratio, rowHeight, offset, firstRow, rows, selectedRow, scale, dataDate },
        theme.current!,
      ),
    );
    return () => cancelAnimationFrame(frame);
  }, [size, ratio, rowHeight, offset, firstRow, rows, selectedRow, scale, dataDate]);

  useEffect(() => {
    if (size.width > 0) onWidth?.(size.width);
  }, [size.width, onWidth]);

  const rowAt = (event: PointerEvent) => {
    const y = event.clientY - event.currentTarget.getBoundingClientRect().top - rowHeight + offset;
    return y < 0 ? -1 : firstRow + Math.floor(y / rowHeight);
  };

  const from = longDate(Math.round(scale.origin));
  const to = longDate(Math.round(timeAt(size.width, scale)));
  const label =
    total === 0
      ? 'Gantt chart. No rows.'
      : `Gantt chart of rows ${count(firstRow + 1)} to ${count(Math.min(total, firstRow + rows.length))} of ${count(total)}, from ${from} to ${to}. Each bar is this update; a coloured line beneath it runs from the previous finish. Every date drawn here is in the grid beside it.`;

  return (
    <canvas
      ref={canvas}
      className={styles.gantt}
      role="img"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={(event) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) {
          const delta = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
          onPan(Math.round(scale.origin + (delta / scale.pxPerDay) * MINUTES_PER_DAY));
        } else {
          onScrollRows(event.deltaY);
        }
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, origin: scale.origin, moved: false };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start) return;
        const dx = event.clientX - start.x;
        if (Math.abs(dx) > 3) start.moved = true;
        if (start.moved) onPan(Math.round(start.origin - (dx / scale.pxPerDay) * MINUTES_PER_DAY));
      }}
      onPointerUp={(event) => {
        const start = drag.current;
        drag.current = null;
        if (start?.moved) return;
        const row = rowAt(event);
        if (row >= 0 && row < total) onSelectRow(row);
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}
