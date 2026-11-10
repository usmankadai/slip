/**
 * Edits to the current update. The imported columns are never changed: an
 * edited schedule is the original with fresh copies of the few columns that
 * can be edited, and every patch applied to those copies in order. Reverting
 * a patch rebuilds the copies from the original and the patches that remain,
 * so there is no way to end up with a half-reverted value.
 */
import { ConstraintType, NONE, TaskType, type ScheduleData } from '@slip/xer';
import type { CpmResult } from './cpm.ts';

/** What can be edited, and the column each one lives in. */
export const EDIT_FIELDS = {
  originalDuration: 'originalDurationMin',
  remainingDuration: 'remainingDurationMin',
  constraintType: 'constraintType',
  constraintDate: 'constraintDate',
} as const satisfies Record<string, keyof ScheduleData>;

export type EditField = keyof typeof EDIT_FIELDS;

export interface EditPatch {
  id: string;
  /** Activity index in the current update. */
  activity: number;
  /** The activity's code, so a patch can be replayed against a reloaded file. */
  taskCode: string;
  field: EditField;
  from: number;
  to: number;
}

/** A milestone whose date an edit moved. */
export interface MilestoneMove {
  activity: number;
  finishBefore: number;
  finishAfter: number;
}

/** A hundred years of minutes: no real duration is longer. */
const MAX_DURATION = 100 * 365 * 1440;
const CONSTRAINT_VALUES = new Set<number>(
  Object.values(ConstraintType).filter((value) => value !== ConstraintType.Unknown),
);

export const isEditField = (field: unknown): field is EditField =>
  typeof field === 'string' && Object.hasOwn(EDIT_FIELDS, field);

/** Returns why a value is not acceptable for a field, or null if it is. */
export function invalidEdit(
  data: ScheduleData,
  activity: number,
  field: EditField,
  to: number,
): string | null {
  if (!Number.isInteger(to)) return 'The new value must be a whole number.';
  if (data.actualFinish[activity] !== NONE)
    return 'That activity is finished, so changing it would not move anything.';
  if (field === 'originalDuration' || field === 'remainingDuration') {
    if (to < 0 || to > MAX_DURATION)
      return 'A duration must be zero or more, and no longer than 100 years.';
    const type = data.type[activity]!;
    if ((type === TaskType.StartMilestone || type === TaskType.FinishMilestone) && to !== 0) {
      return 'A milestone has no duration.';
    }
    if (field === 'remainingDuration' && data.actualStart[activity] === NONE) {
      return 'That activity has not started; change its original duration.';
    }
  } else if (field === 'constraintType') {
    if (!CONSTRAINT_VALUES.has(to)) return 'Unknown constraint type.';
  } else if (to !== NONE && Math.abs(to) > 2_000_000_000) {
    return 'That date is out of range.';
  }
  return null;
}

/** The original schedule with every patch applied. Shares all columns that cannot be edited. */
export function withEdits(base: ScheduleData, patches: readonly EditPatch[]): ScheduleData {
  if (patches.length === 0) return base;
  const edited: ScheduleData = {
    ...base,
    originalDurationMin: base.originalDurationMin.slice(),
    remainingDurationMin: base.remainingDurationMin.slice(),
    constraintType: base.constraintType.slice(),
    constraintDate: base.constraintDate.slice(),
  };
  for (const patch of patches) edited[EDIT_FIELDS[patch.field]][patch.activity] = patch.to;
  return edited;
}

const DATE_COLUMNS = [
  'earlyStart',
  'earlyFinish',
  'lateStart',
  'lateFinish',
  'totalFloat',
] as const;

/** Activities whose dates or float differ between two CPM results, in index order. */
export function changedActivities(before: CpmResult, after: CpmResult): Int32Array {
  const n = after.earlyStart.length;
  const out = new Int32Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (const column of DATE_COLUMNS) {
      if (before[column][i] !== after[column][i]) {
        out[count++] = i;
        break;
      }
    }
  }
  return out.slice(0, count);
}

/** Milestones among `changed` whose finish moved, the biggest move first, at most `limit` of them. */
export function milestoneMoves(
  data: ScheduleData,
  before: CpmResult,
  after: CpmResult,
  changed: Int32Array,
  limit = 50,
): MilestoneMove[] {
  const moves: MilestoneMove[] = [];
  for (const i of changed) {
    const type = data.type[i]!;
    if (type !== TaskType.StartMilestone && type !== TaskType.FinishMilestone) continue;
    if (before.earlyFinish[i] === after.earlyFinish[i]) continue;
    moves.push({
      activity: i,
      finishBefore: before.earlyFinish[i]!,
      finishAfter: after.earlyFinish[i]!,
    });
  }
  moves.sort(
    (x, y) =>
      Math.abs(y.finishAfter - y.finishBefore) - Math.abs(x.finishAfter - x.finishBefore) ||
      x.activity - y.activity,
  );
  return moves.slice(0, limit);
}
