/**
 * What the activity drawer shows (exploration 10, option C): the fields that changed, the logic
 * that changed, and the rest, from the engine's `activity` answer. Pure.
 */
import { formatDelta } from '@slip/ui';
import { Change, type ActivityDetail, type LinkDetail } from '@slip/engine';
import { ConstraintType, NONE, RelType, Status, TaskType } from '@slip/xer';
import { shortDate, workingDays } from '../../shared/format.ts';
import type { TraceView } from '../trace/model.ts';

/** The engine's answer to an `activity` request. */
export interface ActivityAnswer {
  taskCode: string;
  previous: ActivityDetail | null;
  current: ActivityDetail | null;
  flags: number;
  finishDelta: number;
  startDelta: number;
  durationDelta: number;
  floatDelta: number;
}

export interface FieldRow {
  label: string;
  /** Update A's value in words, or '' when the activity is new. */
  was: string;
  now: string;
  /** How it changed: "+11d", "Added", "Changed", or ''. */
  change: string;
  changed: boolean;
}

export interface LinkRow {
  code: string;
  name: string;
  /** "FS", "SS", "FF" or "SF". */
  type: string;
  /** "0d", "3d", "−2d". */
  lag: string;
}

export interface LinkChange extends LinkRow {
  side: 'Predecessor' | 'Successor';
  change: 'Added' | 'Removed' | 'Changed';
}

export interface ActivityModel {
  code: string;
  name: string;
  /** Finish slip in working days on its own calendar, or null when it is new. */
  slipDays: number | null;
  isNew: boolean;
  /** "Now critical", "No longer critical" or ''. */
  critical: string;
  /** Every field, the changed ones first. */
  fields: FieldRow[];
  changedCount: number;
  /**
   * Relationships added, removed or changed, or null when there are more than the engine lists
   * (30 each way), so the two lists cannot be compared in full.
   */
  linkChanges: LinkChange[] | null;
  /** True when the engine says the logic changed: the answer when `linkChanges` is null. */
  logicChanged: boolean;
  predecessors: LinkRow[];
  successors: LinkRow[];
  predecessorCount: number;
  successorCount: number;
}

const CONSTRAINT_WORDS: Record<number, string> = {
  [ConstraintType.None]: 'None',
  [ConstraintType.StartOn]: 'Start on',
  [ConstraintType.StartOnOrAfter]: 'Start on or after',
  [ConstraintType.StartOnOrBefore]: 'Start on or before',
  [ConstraintType.FinishOn]: 'Finish on',
  [ConstraintType.FinishOnOrAfter]: 'Finish on or after',
  [ConstraintType.FinishOnOrBefore]: 'Finish on or before',
  [ConstraintType.MandatoryStart]: 'Mandatory start',
  [ConstraintType.MandatoryFinish]: 'Mandatory finish',
  [ConstraintType.AsLateAsPossible]: 'As late as possible',
};
const STATUS_WORDS: Record<number, string> = {
  [Status.NotStarted]: 'Not started',
  [Status.Active]: 'In progress',
  [Status.Complete]: 'Complete',
};
const TYPE_WORDS: Record<number, string> = {
  [TaskType.Task]: 'Task',
  [TaskType.Resource]: 'Resource dependent',
  [TaskType.StartMilestone]: 'Start milestone',
  [TaskType.FinishMilestone]: 'Finish milestone',
  [TaskType.LevelOfEffort]: 'Level of effort',
  [TaskType.WbsSummary]: 'WBS summary',
};
const REL_WORDS: Record<number, string> = {
  [RelType.FS]: 'FS',
  [RelType.SS]: 'SS',
  [RelType.FF]: 'FF',
  [RelType.SF]: 'SF',
};
/** The engine lists at most this many links each way. */
export const LINKS_LISTED = 30;

const date = (minutes: number) => (minutes === NONE ? 'None' : shortDate(minutes) || 'None');
const days = (minutes: number, dayMinutes: number) =>
  minutes === NONE || !(dayMinutes > 0) ? 'None' : workingDays((minutes / dayMinutes) * 100);
const constraint = (type: number, at: number) => {
  const words = CONSTRAINT_WORDS[type] ?? 'Unknown';
  return type === ConstraintType.None || at === NONE ? words : `${words} ${shortDate(at)}`;
};
/** A movement in working minutes as signed working days, or '' when it did not move. */
const moved = (minutes: number, dayMinutes: number) => {
  if (minutes === NONE || !(dayMinutes > 0)) return '';
  const value = minutes / dayMinutes;
  return Math.abs(value) < 0.05 ? '' : formatDelta(value);
};

function linkRow(link: LinkDetail, dayMinutes: number): LinkRow {
  return {
    code: link.taskCode,
    name: link.name,
    type: REL_WORDS[link.type] ?? '?',
    lag: days(link.lagMinutes, dayMinutes),
  };
}

function compareLinks(
  side: LinkChange['side'],
  was: LinkDetail[],
  now: LinkDetail[],
  dayMinutes: number,
): LinkChange[] {
  const before = new Map(was.map((link) => [link.taskCode, link]));
  const after = new Map(now.map((link) => [link.taskCode, link]));
  const out: LinkChange[] = [];
  for (const link of now) {
    const old = before.get(link.taskCode);
    if (!old) out.push({ side, change: 'Added', ...linkRow(link, dayMinutes) });
    else if (old.type !== link.type || old.lagMinutes !== link.lagMinutes) {
      out.push({ side, change: 'Changed', ...linkRow(link, dayMinutes) });
    }
  }
  for (const link of was) {
    if (!after.has(link.taskCode))
      out.push({ side, change: 'Removed', ...linkRow(link, dayMinutes) });
  }
  return out;
}

/**
 * The drawer's content for one activity. `calendarName` turns a calendar index into its name.
 * Null when the activity is not in update B, which the changes grid never offers.
 */
export function activityModel(
  answer: ActivityAnswer,
  calendarName: (index: number) => string = () => '',
): ActivityModel | null {
  const now = answer.current;
  if (!now) return null;
  const was = answer.previous;
  const day = now.dayMinutes;
  const isNew = was === null;

  const row = (label: string, a: string, b: string, change = a !== b ? 'Changed' : ''): FieldRow =>
    isNew
      ? { label, was: '', now: b, change: '', changed: false }
      : { label, was: a, now: b, change, changed: change !== '' };
  const durationChange = (a: number, b: number) =>
    a === NONE || b === NONE ? (a === b ? '' : 'Changed') : moved(b - a, day);

  const fields: FieldRow[] = [
    row('Finish', was ? date(was.finish) : '', date(now.finish), moved(answer.finishDelta, day)),
    row('Start', was ? date(was.start) : '', date(now.start), moved(answer.startDelta, day)),
    row(
      'Original duration',
      was ? days(was.originalDuration, was.dayMinutes) : '',
      days(now.originalDuration, day),
      was ? durationChange(was.originalDuration, now.originalDuration) : '',
    ),
    row(
      'Remaining duration',
      was ? days(was.remainingDuration, was.dayMinutes) : '',
      days(now.remainingDuration, day),
      was ? durationChange(was.remainingDuration, now.remainingDuration) : '',
    ),
    row(
      'Total float',
      was ? days(was.totalFloat, was.dayMinutes) : '',
      days(now.totalFloat, day),
      moved(answer.floatDelta, day),
    ),
    row(
      'Constraint',
      was ? constraint(was.constraintType, was.constraintDate) : '',
      constraint(now.constraintType, now.constraintDate),
      !was
        ? ''
        : was.constraintType === now.constraintType && was.constraintDate === now.constraintDate
          ? ''
          : was.constraintType === ConstraintType.None
            ? 'Added'
            : now.constraintType === ConstraintType.None
              ? 'Removed'
              : 'Changed',
    ),
    row(
      'Status',
      was ? (STATUS_WORDS[was.status] ?? 'Unknown') : '',
      STATUS_WORDS[now.status] ?? 'Unknown',
    ),
    row(
      'Activity type',
      was ? (TYPE_WORDS[was.type] ?? 'Unknown') : '',
      TYPE_WORDS[now.type] ?? 'Unknown',
    ),
    row('Calendar', was ? calendarName(was.calendar) : '', calendarName(now.calendar)),
    row('WBS', was?.wbs ?? '', now.wbs),
    row('Actual start', was ? date(was.actualStart) : '', date(now.actualStart)),
    row('Actual finish', was ? date(was.actualFinish) : '', date(now.actualFinish)),
  ];
  const ordered = [...fields.filter((f) => f.changed), ...fields.filter((f) => !f.changed)];

  // The two lists can be compared only when both are complete.
  const complete =
    was !== null &&
    Math.max(was.predecessorCount, was.successorCount, now.predecessorCount, now.successorCount) <=
      LINKS_LISTED;
  const linkChanges = isNew
    ? []
    : complete
      ? [
          ...compareLinks('Predecessor', was.predecessors, now.predecessors, day),
          ...compareLinks('Successor', was.successors, now.successors, day),
        ]
      : null;

  return {
    code: now.taskCode,
    name: now.name,
    slipDays: isNew || answer.finishDelta === NONE || !(day > 0) ? null : answer.finishDelta / day,
    isNew,
    critical:
      answer.flags & Change.JoinedCriticalPath
        ? 'Now critical'
        : answer.flags & Change.LeftCriticalPath
          ? 'No longer critical'
          : '',
    fields: ordered,
    changedCount: fields.filter((f) => f.changed).length,
    linkChanges,
    logicChanged: (answer.flags & Change.LogicChanged) !== 0,
    predecessors: now.predecessors.map((link) => linkRow(link, day)),
    successors: now.successors.map((link) => linkRow(link, day)),
    predecessorCount: now.predecessorCount,
    successorCount: now.successorCount,
  };
}

/**
 * One or two sentences on why the activity moved, from its trace: the largest causes, with the
 * words the trace screen uses. Null when there is nothing to explain.
 */
export function whySentence(trace: TraceView, code: string): string | null {
  if (Math.abs(trace.slipDays) < 0.05) return null;
  const top = trace.causes.slice(0, 2);
  if (top.length === 0) {
    return 'The trace found no activity on its driving path that added time of its own. Open the trace to see the path.';
  }
  const named = top.map((cause) => {
    const who = cause.code === code ? 'this activity' : cause.name || cause.code || 'an activity';
    const what = (cause.what[0] ?? 'Changed').toLowerCase();
    return `${who} (${what}, ${formatDelta(cause.days)})`;
  });
  const lead =
    top.length === 1
      ? `The largest cause is ${named[0]}.`
      : `The largest causes are ${named[0]} and ${named[1]}.`;
  const more = trace.causes.length + trace.minor.length - top.length;
  return more > 0
    ? `${lead} ${more} more ${more === 1 ? 'activity' : 'activities'} also moved it.`
    : lead;
}
