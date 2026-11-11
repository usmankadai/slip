import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { SortSpec } from '@slip/engine';
import { DeltaCell, ROW_HEIGHT, Skeleton, type Density } from '@slip/ui';
import { NONE } from '@slip/xer';
import { count, shortDate, workingDays } from '../../shared/format.ts';
import styles from './changes.module.css';
import { COLUMNS, changeWords, scrollReadout, type Column } from './model.ts';
import type { GridRow } from './useGridRows.ts';
import {
  firstRowAt,
  firstRowToReveal,
  rowsInView,
  scrollHeight,
  scrollTopFor,
  wholeRowsInView,
  windowAt,
} from './virtual.ts';

export interface ChangesGridProps {
  /** Rows in the view after filtering. */
  total: number;
  density: Density;
  /** The row's values, or undefined while they are being fetched. */
  rowAt: (row: number) => GridRow | undefined;
  /** Told which rows are on screen, so they can be fetched. */
  onRows: (start: number, end: number) => void;
  /** Told which rows are on screen, 1-based, for the status line. */
  onPosition: (first: number, last: number) => void;
  sort: SortSpec | null;
  onSort: (column: Column) => void;
  /** The selected row's position in the view, or null. */
  selectedRow: number | null;
  onSelectRow: (row: number) => void;
  /** Change `nonce` to bring `row` into view, for example after the sort changes. */
  reveal: { row: number; nonce: number } | null;
}

const READOUT_MS = 900;

function Cells({ row, position }: { row: GridRow | undefined; position: number }) {
  if (!row) {
    return (
      <>
        <span role="gridcell" className={`${styles.cell} ${styles.rowNumber}`}>
          {count(position + 1)}
        </span>
        <span role="gridcell" className={styles.cell}>
          <Skeleton width="long" />
        </span>
        <span role="gridcell" className={styles.cell}>
          <Skeleton width="medium" />
        </span>
        <span role="gridcell" className={styles.cell} />
        <span role="gridcell" className={styles.cell} />
        <span role="gridcell" className={styles.cell} />
        <span role="gridcell" className={styles.cell} />
        <span role="gridcell" className={styles.cell} />
      </>
    );
  }
  return (
    <>
      <span role="gridcell" className={`${styles.cell} ${styles.rowNumber}`}>
        {count(position + 1)}
      </span>
      <span role="gridcell" className={`${styles.cell} ${styles.code}`}>
        {row.code}
      </span>
      <span role="gridcell" className={styles.cell} title={row.name}>
        {row.name}
      </span>
      <span role="gridcell" className={`${styles.cell} ${styles.date}`}>
        {shortDate(row.was)}
      </span>
      <span role="gridcell" className={`${styles.cell} ${styles.date}`}>
        {shortDate(row.now)}
      </span>
      <span role="gridcell" className={`${styles.cell} ${styles.numeric}`}>
        <DeltaCell days={row.slipDays} />
      </span>
      <span role="gridcell" className={`${styles.cell} ${styles.numeric}`}>
        {row.float === NONE ? '' : workingDays(row.float)}
      </span>
      <span role="gridcell" className={`${styles.cell} ${styles.words}`}>
        {changeWords(row.flags)}
      </span>
    </>
  );
}

/**
 * The windowed grid. Only the rows on screen are in the document, whatever the size
 * of the view; the scrolling element is never taller than the cap in virtual.ts.
 */
export function ChangesGrid({
  total,
  density,
  rowAt,
  onRows,
  onPosition,
  sort,
  onSort,
  selectedRow,
  onSelectRow,
  reveal,
}: ChangesGridProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(0);
  const [scrolling, setScrolling] = useState(false);
  const readoutTimer = useRef(0);
  const rowHeight = ROW_HEIGHT[density];
  const viewport = { total, rowHeight, height };
  const visible = windowAt(scrollTop, viewport);
  const fits = Math.max(1, Math.floor(height / rowHeight));

  // The area for rows is the scroller less the header, which is one row tall.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => setHeight(Math.max(0, element.clientHeight - rowHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rowHeight]);

  useEffect(() => {
    onRows(visible.start, visible.end);
  }, [visible.start, visible.end, onRows]);

  const whole = wholeRowsInView(scrollTop, viewport);
  useEffect(() => {
    onPosition(whole.first, whole.last);
  }, [whole.first, whole.last, onPosition]);

  useEffect(() => () => clearTimeout(readoutTimer.current), []);

  const scrollToFirst = useCallback(
    (first: number) => {
      const element = scroller.current;
      if (element) element.scrollTop = scrollTopFor(first, { total, rowHeight, height });
    },
    [total, rowHeight, height],
  );

  // Bring a row into view when asked, moving as little as possible.
  const revealNonce = reveal?.nonce;
  useEffect(() => {
    if (!reveal || height === 0) return;
    const element = scroller.current;
    if (!element) return;
    const current = firstRowAt(element.scrollTop, { total, rowHeight, height });
    const next = firstRowToReveal(reveal.row, current, { total, rowHeight, height });
    if (next !== current) scrollToFirst(next);
    // Runs when a new reveal is asked for, or once the grid has a height; not whenever the list changes.
  }, [revealNonce, height === 0]);

  function select(row: number) {
    const next = Math.min(Math.max(row, 0), total - 1);
    onSelectRow(next);
    const element = scroller.current;
    if (!element) return;
    const current = firstRowAt(element.scrollTop, viewport);
    const first = firstRowToReveal(next, current, viewport);
    if (first !== current) scrollToFirst(first);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (total === 0) return;
    const at = selectedRow ?? visible.start - 1;
    const moves: Record<string, number> = {
      ArrowDown: at + 1,
      ArrowUp: at - 1,
      PageDown: at + fits,
      PageUp: at - fits,
      Home: 0,
      End: total - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  }

  const rows = [];
  for (let position = visible.start; position < visible.end; position++) {
    const selected = position === selectedRow;
    rows.push(
      <div
        key={position}
        role="row"
        aria-rowindex={position + 2}
        aria-selected={selected}
        className={`${styles.row} ${selected ? styles.selected : ''}`}
        onClick={() => onSelectRow(position)}
      >
        <Cells row={rowAt(position)} position={position} />
      </div>,
    );
  }

  return (
    <div className={styles.gridFrame} data-density={density}>
      <div
        ref={scroller}
        className={styles.scroller}
        role="grid"
        aria-label="Activities"
        aria-rowcount={total + 1}
        aria-colcount={COLUMNS.length + 1}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onScroll={(event) => {
          setScrollTop(event.currentTarget.scrollTop);
          setScrolling(true);
          clearTimeout(readoutTimer.current);
          readoutTimer.current = window.setTimeout(() => setScrolling(false), READOUT_MS);
        }}
      >
        <div role="row" aria-rowindex={1} className={`${styles.row} ${styles.head}`}>
          <span role="columnheader" className={`${styles.cell} ${styles.rowNumber}`}>
            Row
          </span>
          {COLUMNS.map((column) => {
            const sorted = column.sortBy !== null && sort?.column === column.sortBy;
            const direction = sorted
              ? sort.direction === 'asc'
                ? 'ascending'
                : 'descending'
              : undefined;
            return (
              <span
                key={column.id}
                role="columnheader"
                aria-sort={direction}
                className={`${styles.cell} ${column.numeric ? styles.numeric : ''}`}
              >
                {column.sortBy ? (
                  <button type="button" className={styles.sort} onClick={() => onSort(column)}>
                    {column.label}
                    <span aria-hidden="true">
                      {sorted ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}
                    </span>
                  </button>
                ) : (
                  column.label
                )}
              </span>
            );
          })}
        </div>
        <div className={styles.spacer} style={{ height: scrollHeight(viewport) }}>
          <div
            className={styles.layer}
            style={{ height: Math.min(height, total * rowHeight), top: rowHeight }}
          >
            <div style={{ transform: `translateY(${-visible.offset}px)` }}>{rows}</div>
          </div>
        </div>
      </div>
      {scrolling && total > rowsInView(viewport) ? (
        <div className={styles.readout} aria-hidden="true">
          {scrollReadout(visible.start + 1, total)}
        </div>
      ) : null}
    </div>
  );
}
