/**
 * Asks the engine worker for the parts of the update summary. Each part is
 * requested on its own and fills in when it arrives, so nothing waits for
 * the slowest. Only small results come back (D3).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Change } from '@slip/engine';
import { NONE, TaskType } from '@slip/xer';
import { engine } from '../../app/engine.ts';
import { EngineRequestError } from '../../workers/engineClient.ts';
import { longDate } from '../../shared/format.ts';
import {
  LOADING_STATE,
  MILESTONE_ROWS,
  healthDelta,
  milestoneList,
  recalculationNotice,
  type MilestoneRow,
  type SummaryState,
} from './model.ts';

const MILESTONES = [TaskType.StartMilestone, TaskType.FinishMilestone];
const MOVED = { types: MILESTONES, flagsAny: Change.FinishMoved };

function message(error: unknown): string {
  if (error instanceof EngineRequestError) {
    if (error.code === 'out-of-memory') {
      return 'There was not enough memory to compare the two updates. Closing other tabs may help.';
    }
    if (error.code === 'crashed' || error.code === 'not-loaded') {
      return 'The engine stopped and the schedules are no longer loaded. Go back to import and load them again.';
    }
  }
  return 'Something went wrong while comparing the two updates.';
}

async function milestones(
  direction: 'asc' | 'desc',
): Promise<{ rows: MilestoneRow[]; total: number }> {
  const result = await engine().request({
    type: 'rows',
    slot: 'b',
    range: [0, MILESTONE_ROWS],
    columns: ['code', 'name', 'finish', 'previousFinish', 'finishDeltaDays'],
    filter: MOVED,
    sort: { column: 'finishDeltaDays', direction },
  });
  const rows: MilestoneRow[] = [];
  for (let k = 0; k < result.indices.length; k++) {
    const hundredths = result.numbers.finishDeltaDays?.[k] ?? NONE;
    if (hundredths === NONE) continue;
    rows.push({
      code: result.text.code?.[k] ?? '',
      name: result.text.name?.[k] ?? '',
      was: result.numbers.previousFinish?.[k] ?? NONE,
      now: result.numbers.finish?.[k] ?? NONE,
      days: hundredths / 100,
    });
  }
  return { rows, total: result.total };
}

/** How many rows a filter leaves, without fetching any. */
async function countRows(slot: 'a' | 'b', filter: object): Promise<number> {
  const result = await engine().request({ type: 'rows', slot, range: [0, 0], columns: [], filter });
  return result.total;
}

async function latestFinish(slot: 'a' | 'b'): Promise<number> {
  const result = await engine().request({
    type: 'rows',
    slot,
    range: [0, 1],
    columns: ['finish'],
    sort: { column: 'finish', direction: 'desc' },
  });
  return result.numbers.finish?.[0] ?? NONE;
}

export function useSummary() {
  const [state, setState] = useState<SummaryState>(LOADING_STATE);
  const run = useRef(0);

  const load = useCallback(() => {
    const token = ++run.current;
    const set = (patch: Partial<SummaryState>) => {
      if (run.current === token) setState((previous) => ({ ...previous, ...patch }));
    };
    setState(LOADING_STATE);

    Promise.all([
      milestones('desc'),
      milestones('asc'),
      countRows('b', { types: MILESTONES }),
    ]).then(
      async ([later, earlier, total]) => {
        const list = milestoneList(later.rows, earlier.rows, later.total, total);
        set({ milestones: { status: 'ready', value: list } });
        if (total === 0) {
          const [was, now] = await Promise.all([latestFinish('a'), latestFinish('b')]);
          if (was !== NONE && now !== NONE) {
            set({
              latestFinish:
                was === now
                  ? `The latest finish is ${longDate(now)} in both updates.`
                  : `The latest finish moved from ${longDate(was)} to ${longDate(now)}.`,
            });
          }
        }
      },
      (error: unknown) => set({ milestones: { status: 'error', message: message(error) } }),
    );

    Promise.all([
      engine().request({ type: 'diff' }),
      countRows('b', { flagsAny: Change.StartMoved | Change.FinishMoved }),
    ]).then(
      ([diff, datesMoved]) =>
        set({
          changes: {
            status: 'ready',
            value: {
              datesMoved,
              durationChanged: diff.counts.DurationChanged,
              logicChanged: diff.counts.LogicChanged,
              constraintChanged: diff.counts.ConstraintChanged,
              progressed: diff.counts.Progressed,
              added: diff.counts.Added,
              removed: diff.counts.Removed,
              activities: diff.activitiesB,
              joinedCritical: diff.counts.JoinedCriticalPath,
              leftCritical: diff.counts.LeftCriticalPath,
            },
          },
        }),
      (error: unknown) => set({ changes: { status: 'error', message: message(error) } }),
    );

    Promise.all([
      engine().request({ type: 'health', slot: 'a' }),
      engine().request({ type: 'health', slot: 'b' }),
    ]).then(
      ([a, b]) => set({ health: { status: 'ready', value: healthDelta(a.checks, b.checks) } }),
      (error: unknown) => set({ health: { status: 'error', message: message(error) } }),
    );

    // Last, because it is the slowest and only feeds a note. A preview keeps the file's dates in use.
    engine()
      .request({ type: 'cpm', slot: 'b', preview: true })
      .then(
        (cpm) => set({ recalculation: recalculationNotice(cpm.differsFromFile) }),
        () => {},
      );
  }, []);

  useEffect(() => {
    load();
    return () => {
      run.current++;
    };
  }, [load]);

  return { state, retry: load };
}
