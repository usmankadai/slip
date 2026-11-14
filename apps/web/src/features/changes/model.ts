/** What the changes grid shows: its columns, filters and the words around them. Pure. */
import {
  Change,
  type FilterSpec,
  type NumberColumn,
  type SortSpec,
  type TextColumn,
} from '@slip/engine';
import { count, plural } from '../../shared/format.ts';

/** The kinds of change a planner can filter to. `all` is every activity with any change. */
export type ChangeKind =
  'all' | 'dates' | 'durations' | 'logic' | 'constraints' | 'progress' | 'added';

export const KINDS: { id: ChangeKind; label: string; flags: number }[] = [
  { id: 'all', label: 'All changes', flags: 0 },
  { id: 'dates', label: 'Dates', flags: Change.StartMoved | Change.FinishMoved },
  { id: 'durations', label: 'Durations', flags: Change.DurationChanged },
  { id: 'logic', label: 'Logic', flags: Change.LogicChanged },
  { id: 'constraints', label: 'Constraints', flags: Change.ConstraintChanged },
  { id: 'progress', label: 'Progress', flags: Change.Progressed },
  { id: 'added', label: 'Added', flags: Change.Added },
];

export interface GridFilter {
  /** null shows every activity, changed or not. */
  kind: ChangeKind | null;
  text: string;
  /** Only the activities counted against this DCMA check (1 to 14), when set. */
  healthCheck?: number;
}

export const DEFAULT_FILTER: GridFilter = { kind: 'all', text: '' };

/** The filter as the engine takes it. */
export function engineFilter(filter: GridFilter): FilterSpec {
  const spec: FilterSpec = {};
  if (filter.kind === 'all') spec.changedOnly = true;
  else if (filter.kind) spec.flagsAny = KINDS.find((kind) => kind.id === filter.kind)?.flags ?? 0;
  if (filter.healthCheck !== undefined && Number.isInteger(filter.healthCheck)) {
    spec.healthCheck = filter.healthCheck;
  }
  const text = filter.text.trim();
  if (text) spec.text = text.slice(0, 200);
  return spec;
}

export type ColumnId = 'code' | 'name' | 'was' | 'now' | 'slip' | 'float' | 'changes';

export interface Column {
  id: ColumnId;
  label: string;
  /** The engine column that sorts it, or null when it cannot be sorted. */
  sortBy: TextColumn | NumberColumn | null;
  numeric: boolean;
}

export const COLUMNS: Column[] = [
  { id: 'code', label: 'Activity code', sortBy: 'code', numeric: false },
  { id: 'name', label: 'Name', sortBy: 'name', numeric: false },
  { id: 'was', label: 'Was', sortBy: 'previousFinish', numeric: false },
  { id: 'now', label: 'Now', sortBy: 'finish', numeric: false },
  { id: 'slip', label: 'Finish slip', sortBy: 'finishDeltaDays', numeric: true },
  { id: 'float', label: 'Total float', sortBy: 'totalFloatDays', numeric: true },
  { id: 'changes', label: 'What changed', sortBy: null, numeric: false },
];

/** Largest finish slip first: the worst movers are what the planner came for. */
export const DEFAULT_SORT: SortSpec = { column: 'finishDeltaDays', direction: 'desc' };

/** Clicking a sorted column reverses it; clicking another sorts by it, numbers largest first. */
export function nextSort(current: SortSpec | null, column: Column): SortSpec | null {
  if (!column.sortBy) return current;
  if (current?.column === column.sortBy) {
    return { column: column.sortBy, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { column: column.sortBy, direction: column.numeric ? 'desc' : 'asc' };
}

const FLAG_WORDS: [number, string][] = [
  [Change.Added, 'Added'],
  [Change.StartMoved | Change.FinishMoved, 'Dates'],
  [Change.DurationChanged, 'Duration'],
  [Change.LogicChanged, 'Logic'],
  [Change.ConstraintChanged, 'Constraint'],
  [Change.Progressed, 'Progress'],
  [Change.JoinedCriticalPath, 'Now critical'],
  [Change.LeftCriticalPath, 'No longer critical'],
  [Change.DuplicateCode, 'Duplicate code'],
];

/** The change bitmask of an activity as words, in a fixed order. */
export function changeWords(flags: number): string {
  if (!(flags > 0)) return '';
  return FLAG_WORDS.filter(([mask]) => (flags & mask) !== 0)
    .map(([, word]) => word)
    .join(', ');
}

export interface Position {
  /** Rows on screen, 1-based, or 0 for both when the view is empty. */
  first: number;
  last: number;
  /** Rows the view holds after filtering. */
  total: number;
  /** Activities in update B before filtering. */
  unfiltered: number;
}

/** The status line under the grid (exploration 07, option A). */
export function statusLine(position: Position): { where: string; hidden: string } {
  const { first, last, total, unfiltered } = position;
  const where =
    total === 0
      ? 'No rows'
      : first === last
        ? `Row ${count(first)} of ${count(total)}`
        : `Rows ${count(first)} to ${count(last)} of ${count(total)}`;
  const hiddenRows = Math.max(0, unfiltered - total);
  return {
    where,
    hidden:
      hiddenRows === 0
        ? 'Nothing hidden'
        : `${plural(hiddenRows, 'activity', 'activities')} hidden by the filter`,
  };
}

/** The readout shown while scrolling (exploration 07, option B). */
export function scrollReadout(first: number, total: number): string {
  return `Row ${count(first)} of ${count(total)}`;
}
