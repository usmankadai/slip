/**
 * Fetches the rows the grid is showing from the engine worker. Only the
 * visible window and some rows either side are ever held here: a few
 * hundred small values, whatever the size of the schedule (D3).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FilterSpec, SortSpec } from '@slip/engine';
import { NONE, Status, TaskType } from '@slip/xer';
import { engine } from '../../app/engine.ts';
import { EngineRequestError } from '../../workers/engineClient.ts';
import type { GanttRow } from './gantt/geometry.ts';
import { fetchRange } from './virtual.ts';

export interface GridRow {
  /** Index of the activity in update B. */
  activity: number;
  code: string;
  name: string;
  /** Finish in update A and update B, minutes since the epoch, or NONE. */
  was: number;
  now: number;
  /** Finish slip in working days, or null when there is nothing to compare. */
  slipDays: number | null;
  /** Total float in hundredths of a working day, or NONE. */
  float: number;
  flags: number;
  /** What the Gantt draws for this activity. */
  gantt: GanttRow;
}

export type GridStatus = 'loading' | 'ready' | 'error';

interface Loaded {
  start: number;
  rows: GridRow[];
}

const INITIAL_RANGE: [number, number] = [0, 120];
/** Ask again once the visible rows come this close to the edge of what is held. */
const MARGIN = 15;

export function useGridRows(filter: FilterSpec, sort: SortSpec | null) {
  const [status, setStatus] = useState<GridStatus>('loading');
  const [total, setTotal] = useState(0);
  const [unfiltered, setUnfiltered] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>({ start: 0, rows: [] });
  const [error, setError] = useState('');
  /** Bumped when the filter or sort changes, so answers for an old view are dropped. */
  const view = useRef(0);
  const held = useRef<[number, number]>([0, 0]);
  const asked = useRef<[number, number]>([0, 0]);
  const key = JSON.stringify([filter, sort]);

  const fetch = useCallback(
    (range: [number, number]) => {
      const token = view.current;
      asked.current = range;
      engine()
        .request(
          {
            type: 'rows',
            slot: 'b',
            range,
            columns: [
              'code',
              'name',
              'previousFinish',
              'finish',
              'finishDeltaDays',
              'totalFloatDays',
              'flags',
              'start',
              'previousStart',
              'originalDuration',
              'remainingDuration',
              'status',
              'type',
            ],
            filter,
            sort,
          },
          { supersedes: 'changes-rows' },
        )
        .then(
          (result) => {
            if (view.current !== token) return;
            const rows: GridRow[] = [];
            for (let k = 0; k < result.indices.length; k++) {
              const slip = result.numbers.finishDeltaDays?.[k] ?? NONE;
              const value = (column: keyof typeof result.numbers) =>
                result.numbers[column]?.[k] ?? NONE;
              const state = value('status');
              const type = value('type');
              const float = value('totalFloatDays');
              const original = value('originalDuration');
              const remaining = value('remainingDuration');
              const progress =
                state === Status.Complete
                  ? 1
                  : state === Status.Active && original > 0 && remaining !== NONE
                    ? 1 - remaining / original
                    : 0;
              rows.push({
                gantt: {
                  start: value('start'),
                  finish: value('finish'),
                  previousStart: value('previousStart'),
                  previousFinish: value('previousFinish'),
                  milestone: type === TaskType.StartMilestone || type === TaskType.FinishMilestone,
                  critical: float !== NONE && float <= 0 && state !== Status.Complete,
                  progress,
                },
                activity: result.indices[k]!,
                code: result.text.code?.[k] ?? '',
                name: result.text.name?.[k] ?? '',
                was: result.numbers.previousFinish?.[k] ?? NONE,
                now: result.numbers.finish?.[k] ?? NONE,
                slipDays: slip === NONE ? null : slip / 100,
                float: result.numbers.totalFloatDays?.[k] ?? NONE,
                flags: result.numbers.flags?.[k] ?? 0,
              });
            }
            held.current = result.range;
            setLoaded({ start: result.range[0], rows });
            setTotal(result.total);
            setUnfiltered(result.unfiltered);
            setStatus('ready');
          },
          (reason: unknown) => {
            if (view.current !== token) return;
            // A newer request for the same grid replaced this one. That is normal while scrolling.
            if (
              reason instanceof EngineRequestError &&
              ['superseded', 'cancelled'].includes(reason.code)
            ) {
              return;
            }
            setError(
              reason instanceof EngineRequestError &&
                ['crashed', 'not-loaded'].includes(reason.code)
                ? 'The engine stopped and the schedules are no longer loaded. Go back to import and load them again.'
                : 'Something went wrong while reading the rows.',
            );
            setStatus('error');
          },
        );
    },
    // `key` stands for filter and sort, which are new objects on every render.
    [key],
  );

  useEffect(() => {
    view.current++;
    held.current = [0, 0];
    setStatus('loading');
    setLoaded({ start: 0, rows: [] });
    fetch(INITIAL_RANGE);
  }, [fetch]);

  /** Called by the grid with the rows on screen. Fetches when they near the edge of what is held. */
  const need = useCallback(
    (start: number, end: number, rows: number) => {
      const covered = (range: [number, number]) =>
        range[0] <= Math.max(0, start - MARGIN) && range[1] >= Math.min(rows, end + MARGIN);
      if (rows === 0 || covered(held.current) || covered(asked.current)) return;
      fetch(fetchRange({ start, end, offset: 0 }, rows));
    },
    [fetch],
  );

  const rowAt = useCallback(
    (row: number): GridRow | undefined => loaded.rows[row - loaded.start],
    [loaded],
  );

  const retry = useCallback(() => {
    setStatus('loading');
    fetch(INITIAL_RANGE);
  }, [fetch]);

  return { status, total, unfiltered, error, rowAt, need, retry };
}
