import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SortSpec } from '@slip/engine';
import { Button, Notice, SegmentedControl, type Density } from '@slip/ui';
import { NONE } from '@slip/xer';
import { engine } from '../../app/engine.ts';
import { longDate, plural } from '../../shared/format.ts';
import type { SlotFacts } from '../import/types.ts';
import type { TraceTarget } from '../trace/TraceView.tsx';
import { ChangesGrid } from './ChangesGrid.tsx';
import { Gantt } from './gantt/Gantt.tsx';
import {
  PX_PER_DAY,
  originFor,
  originToFit,
  originToReveal,
  timeAt,
  type Zoom,
} from './gantt/scale.ts';
import { GridMessage } from './GridMessage.tsx';
import styles from './changes.module.css';
import {
  DEFAULT_SORT,
  KINDS,
  engineFilter,
  nextSort,
  statusLine,
  type ChangeKind,
  type Column,
  type GridFilter,
} from './model.ts';
import { useGridRows } from './useGridRows.ts';

const SHOW_OPTIONS = [
  ...KINDS.map((kind) => ({ value: kind.id as string, label: kind.label })),
  { value: 'everything', label: 'All activities' },
];
const DENSITY_OPTIONS = [
  { value: 'compact' as const, label: 'Compact' },
  { value: 'comfortable' as const, label: 'Comfortable' },
];
const ZOOM_OPTIONS = [
  { value: 'weeks' as const, label: 'Weeks' },
  { value: 'months' as const, label: 'Months' },
  { value: 'years' as const, label: 'Years' },
];
const GANTT_OPTIONS = [
  { value: 'shown' as const, label: 'Grid and Gantt' },
  { value: 'hidden' as const, label: 'Grid only' },
];
/** Where the data date sits across the chart when it is first shown or asked for. */
const DATA_DATE_AT = 0.2;
/** A guess at the chart's width before it has been measured, for the first placement only. */
const ASSUMED_WIDTH = 520;
const SEARCH_DELAY_MS = 250;

export function ChangesScreen({
  pair,
  initialKind,
  onBack,
  onTrace,
}: {
  pair: { a: SlotFacts; b: SlotFacts };
  initialKind: ChangeKind;
  onBack: () => void;
  /** Opens the slip trace for the selected activity. */
  onTrace: (target: TraceTarget) => void;
}) {
  const [filter, setFilter] = useState<GridFilter>({ kind: initialKind, text: '' });
  const [typed, setTyped] = useState('');
  const [sort, setSort] = useState<SortSpec | null>(DEFAULT_SORT);
  const [density, setDensity] = useState<Density>('compact');
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [reveal, setReveal] = useState<{ row: number; nonce: number } | null>(null);
  const [lostSelection, setLostSelection] = useState(false);
  const [position, setPosition] = useState({ first: 0, last: 0 });
  const [removed, setRemoved] = useState(0);
  const [gantt, setGantt] = useState<'shown' | 'hidden'>('shown');
  const [zoom, setZoom] = useState<Zoom>('months');
  const dataDate = pair.b.dataDate === NONE ? 0 : pair.b.dataDate;
  const [origin, setOrigin] = useState(() =>
    originFor(dataDate, DATA_DATE_AT, ASSUMED_WIDTH, PX_PER_DAY.months),
  );
  const scale = useMemo(() => ({ origin, pxPerDay: PX_PER_DAY[zoom] }), [origin, zoom]);
  const [width, setWidth] = useState(ASSUMED_WIDTH);
  /** The rows on screen, 0-based, for fitting the time axis to them. */
  const onScreen = useRef({ start: 0, end: 0 });
  /** True once the axis has been fitted to the first rows of a view. */
  const fitted = useRef(false);
  /** The selected activity, kept so the planner's place survives a new filter or sort. */
  const selectedActivity = useRef<number | null>(null);

  const spec = useMemo(() => engineFilter(filter), [filter]);
  const { status, total, unfiltered, error, rowAt, need, retry } = useGridRows(spec, sort);

  // Typing does not ask the engine on every key.
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilter((previous) =>
          previous.text === typed ? previous : { ...previous, text: typed },
        ),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [typed]);

  useEffect(() => {
    engine()
      .request({ type: 'diff' })
      .then(
        (diff) => setRemoved(diff.counts.Removed),
        () => {},
      );
  }, []);

  // Remember which activity is selected, once its row has been fetched.
  const selected = selectedRow === null ? undefined : rowAt(selectedRow);
  useEffect(() => {
    if (selected) selectedActivity.current = selected.activity;
  }, [selected]);

  // After a new filter or sort, find the selected activity again and bring it back into view.
  const viewKey = JSON.stringify([spec, sort]);
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    const activity = selectedActivity.current;
    setSelectedRow(null);
    setLostSelection(false);
    const toTop = () => setReveal((previous) => ({ row: 0, nonce: (previous?.nonce ?? 0) + 1 }));
    if (activity === null) {
      toTop();
      return;
    }
    let current = true;
    engine()
      .request({ type: 'locate', slot: 'b', activity, filter: spec, sort })
      .then(
        (found) => {
          if (!current) return;
          if (found.row < 0) {
            selectedActivity.current = null;
            setLostSelection(true);
            toTop();
            return;
          }
          setSelectedRow(found.row);
          setReveal((previous) => ({ row: found.row, nonce: (previous?.nonce ?? 0) + 1 }));
        },
        () => {},
      );
    return () => {
      current = false;
    };
    // `viewKey` stands for the filter and sort.
  }, [viewKey]);

  const onSort = useCallback(
    (column: Column) => setSort((current) => nextSort(current, column)),
    [],
  );
  const onRows = useCallback(
    (start: number, end: number) => {
      onScreen.current = { start, end };
      need(start, end, total);
    },
    [need, total],
  );

  /** Puts the earliest bar among the rows on screen near the left edge of the chart. */
  const fitToRows = useCallback(
    (pxPerDay: number) => {
      const starts: number[] = [];
      for (let row = onScreen.current.start; row < onScreen.current.end; row++) {
        const bar = rowAt(row)?.gantt;
        if (bar) starts.push(bar.start === NONE ? bar.finish : bar.start);
      }
      const next = originToFit(starts, width, pxPerDay, NONE);
      if (next !== null) setOrigin(next);
      return next !== null;
    },
    [rowAt, width],
  );

  // When the rows of a new view first arrive, show their bars; otherwise the chart may be empty.
  useEffect(() => {
    fitted.current = false;
  }, [viewKey]);
  useEffect(() => {
    if (status === 'ready' && !fitted.current && selectedRow === null) {
      fitted.current = fitToRows(PX_PER_DAY[zoom]);
    }
  }, [status, fitToRows, zoom, selectedRow]);

  // Selecting an activity brings its bar into view, moving the axis only if it has to.
  const selectedBar = selected?.gantt;
  useEffect(() => {
    if (!selectedBar || selectedBar.finish === NONE) return;
    const start = selectedBar.start === NONE ? selectedBar.finish : selectedBar.start;
    setOrigin((current) =>
      originToReveal(
        start,
        selectedBar.finish,
        { origin: current, pxPerDay: PX_PER_DAY[zoom] },
        width,
      ),
    );
    // Runs when the selection changes, not when the axis is dragged afterwards.
  }, [selectedBar]);

  /** Changes the time scale, keeping the moment at the middle of the chart where it is. */
  const changeZoom = (next: Zoom) => {
    const middle = timeAt(width / 2, scale);
    setZoom(next);
    setOrigin(originFor(middle, 0.5, width, PX_PER_DAY[next]));
  };
  const onPosition = useCallback((first: number, last: number) => setPosition({ first, last }), []);
  const onSelectRow = useCallback((row: number) => {
    setSelectedRow(row);
    setLostSelection(false);
  }, []);

  const traceSelected = () => {
    if (selected) {
      onTrace({ code: selected.code, name: selected.name, was: selected.was, now: selected.now });
    }
  };

  const line = statusLine({ ...position, total, unfiltered });
  const showAll = () => {
    setTyped('');
    setFilter({ kind: null, text: '' });
  };

  return (
    <main
      className={styles.screen}
      onKeyDown={(event) => {
        // "t" traces the selected activity, unless the planner is typing in the search box.
        const typing = event.target instanceof HTMLInputElement;
        if (event.key === 't' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
          traceSelected();
        }
      }}
    >
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{pair.b.projectName || 'Project with no name'}</h1>
          <p className={styles.period}>
            Changes · {longDate(pair.a.dataDate)} to {longDate(pair.b.dataDate)}
          </p>
        </div>
        <Button variant="quiet" onClick={onBack}>
          Back to summary
        </Button>
      </header>

      <div className={styles.toolbar}>
        <SegmentedControl
          label="Show"
          options={SHOW_OPTIONS}
          value={filter.kind ?? 'everything'}
          onChange={(value) =>
            setFilter((previous) => ({
              ...previous,
              kind: value === 'everything' ? null : (value as ChangeKind),
            }))
          }
        />
        <label className={styles.search}>
          Find
          <input
            type="search"
            value={typed}
            maxLength={200}
            placeholder="Code or name"
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>
        <div className={styles.push}>
          <Button
            disabled={!selected}
            title="Trace the selected activity (t)"
            onClick={traceSelected}
          >
            Trace selected
          </Button>
          {gantt === 'shown' ? (
            <>
              <SegmentedControl
                label="Time scale"
                options={ZOOM_OPTIONS}
                value={zoom}
                onChange={changeZoom}
              />
              <Button variant="quiet" onClick={() => fitToRows(scale.pxPerDay)}>
                Fit to rows
              </Button>
              <Button
                variant="quiet"
                onClick={() => setOrigin(originFor(dataDate, DATA_DATE_AT, width, scale.pxPerDay))}
              >
                Go to data date
              </Button>
            </>
          ) : null}
          <SegmentedControl
            label="Layout"
            options={GANTT_OPTIONS}
            value={gantt}
            onChange={setGantt}
          />
          <SegmentedControl
            label="Density"
            options={DENSITY_OPTIONS}
            value={density}
            onChange={setDensity}
          />
        </div>
      </div>

      {status === 'error' ? (
        <GridMessage
          alert
          title="Slip could not read the rows"
          body={error}
          action={<Button onClick={retry}>Try again</Button>}
        />
      ) : status === 'ready' && total === 0 ? (
        <GridMessage
          title="No activity matches"
          body={
            filter.text.trim()
              ? `Nothing in this view has "${filter.text.trim()}" in its code or name.`
              : 'No activity has this kind of change between the two updates.'
          }
          action={
            <Button onClick={showAll}>
              Show all {plural(unfiltered, 'activity', 'activities')}
            </Button>
          }
        />
      ) : (
        <ChangesGrid
          total={status === 'loading' ? Math.max(total, 30) : total}
          density={density}
          rowAt={status === 'loading' ? () => undefined : rowAt}
          onRows={onRows}
          onPosition={onPosition}
          sort={sort}
          onSort={onSort}
          selectedRow={selectedRow}
          onSelectRow={onSelectRow}
          reveal={reveal}
          aside={
            gantt === 'hidden'
              ? undefined
              : (rows) => (
                  <Gantt
                    rowHeight={rows.rowHeight}
                    firstRow={rows.firstRow}
                    offset={rows.offset}
                    rows={Array.from({ length: rows.count }, (_, k) =>
                      status === 'loading' ? undefined : rowAt(rows.firstRow + k)?.gantt,
                    )}
                    total={status === 'loading' ? 0 : total}
                    selectedRow={selectedRow}
                    onSelectRow={onSelectRow}
                    scale={scale}
                    onPan={setOrigin}
                    dataDate={dataDate}
                    onScrollRows={rows.scrollBy}
                    onKeyDown={rows.onKeyDown}
                    onWidth={setWidth}
                  />
                )
          }
        />
      )}

      <div>
        {lostSelection ? (
          <Notice>The activity you had selected is hidden by this filter.</Notice>
        ) : null}
        <p className={styles.status} aria-live="polite">
          {status === 'loading' ? (
            <span>Reading the rows</span>
          ) : (
            <>
              <span className={styles.where}>{line.where}</span>
              <span>{line.hidden}</span>
              {unfiltered > total && total > 0 ? (
                <Button variant="quiet" onClick={showAll}>
                  Show all {plural(unfiltered, 'activity', 'activities')}
                </Button>
              ) : null}
              {removed > 0 ? (
                <span>
                  {plural(removed, 'removed activity is', 'removed activities are')} not listed:
                  they are not in update B.
                </span>
              ) : null}
            </>
          )}
        </p>
      </div>
    </main>
  );
}
