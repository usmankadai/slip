/**
 * Runs the agent's tools against the engine. This is the only place where
 * schedule data is turned into text for the model, so it is also where the
 * limits on that are enforced: a tool result is a few kilobytes of the rows
 * the model asked for, never the schedule.
 *
 * It talks to the engine through one small interface, so the same code runs
 * in the browser against the engine worker and in tests against a session.
 */
import {
  Change,
  type EngineRequest,
  type EngineResult,
  type ActivityDetail,
  type ScheduleInfo,
} from '@slip/engine';
import {
  ConstraintType,
  NONE,
  RelType,
  Status,
  TaskType,
  formatXerDate,
  parseXerDate,
} from '@slip/xer';
import { codesInResult } from './citations.ts';
import {
  CHANGE_KINDS,
  CONSTRAINT_TYPES,
  TOOL_LIMITS,
  capResult,
  parseToolCall,
  type ToolInput,
  type ToolName,
} from './tools.ts';

export interface ToolEngine {
  request<T extends EngineRequest['type']>(
    request: Extract<EngineRequest, { type: T }>,
  ): Promise<Extract<EngineResult, { type: T }>>;
}

/** An edit the agent proposed, for the planner to approve or reject. Nothing has been changed. */
export interface Proposal {
  taskCode: string;
  activity: number;
  field: 'originalDuration' | 'remainingDuration' | 'constraintType' | 'constraintDate';
  from: number;
  to: number;
  /** A second change that goes with the first: a constraint needs both a type and a date. */
  also?: { field: 'constraintDate'; to: number };
  reason: string;
}

export interface ToolOutcome {
  /** JSON to send to the model as the tool result. */
  content: string;
  isError: boolean;
  /** Activity codes the result contains. Only these may be cited in the answer. */
  codes: string[];
  proposal?: Proposal;
}

const CHANGE_BITS: [number, (typeof CHANGE_KINDS)[number]][] = [
  [Change.Added, 'added'],
  [Change.StartMoved, 'start_moved'],
  [Change.FinishMoved, 'finish_moved'],
  [Change.DurationChanged, 'duration_changed'],
  [Change.Progressed, 'progressed'],
  [Change.ConstraintChanged, 'constraint_changed'],
  [Change.LogicChanged, 'logic_changed'],
  [Change.FloatChanged, 'float_changed'],
  [Change.JoinedCriticalPath, 'joined_critical_path'],
  [Change.LeftCriticalPath, 'left_critical_path'],
];
const STATUS_NAMES: Record<number, string> = {
  [Status.NotStarted]: 'not_started',
  [Status.Active]: 'in_progress',
  [Status.Complete]: 'complete',
};
const STATUS_VALUES: Record<string, number> = {
  not_started: Status.NotStarted,
  in_progress: Status.Active,
  complete: Status.Complete,
};
const TYPE_NAMES: Record<number, string> = {
  [TaskType.Task]: 'task',
  [TaskType.Resource]: 'task',
  [TaskType.StartMilestone]: 'start_milestone',
  [TaskType.FinishMilestone]: 'finish_milestone',
  [TaskType.LevelOfEffort]: 'level_of_effort',
  [TaskType.WbsSummary]: 'wbs_summary',
};
const REL_NAMES: Record<number, string> = {
  [RelType.FS]: 'FS',
  [RelType.SS]: 'SS',
  [RelType.FF]: 'FF',
  [RelType.SF]: 'SF',
};
const CONSTRAINT_NAMES: Record<number, string> = {
  [ConstraintType.StartOn]: 'start_on',
  [ConstraintType.StartOnOrAfter]: 'start_on_or_after',
  [ConstraintType.StartOnOrBefore]: 'start_on_or_before',
  [ConstraintType.FinishOn]: 'finish_on',
  [ConstraintType.FinishOnOrAfter]: 'finish_on_or_after',
  [ConstraintType.FinishOnOrBefore]: 'finish_on_or_before',
  [ConstraintType.MandatoryStart]: 'mandatory_start',
  [ConstraintType.MandatoryFinish]: 'mandatory_finish',
  [ConstraintType.AsLateAsPossible]: 'as_late_as_possible',
};
const CONSTRAINT_VALUES: Record<(typeof CONSTRAINT_TYPES)[number], number> = {
  none: ConstraintType.None,
  start_on: ConstraintType.StartOn,
  start_on_or_after: ConstraintType.StartOnOrAfter,
  start_on_or_before: ConstraintType.StartOnOrBefore,
  finish_on: ConstraintType.FinishOn,
  finish_on_or_after: ConstraintType.FinishOnOrAfter,
  finish_on_or_before: ConstraintType.FinishOnOrBefore,
};
const TRACE_ENDS = [
  'driven',
  'finished_work',
  'data_date',
  'constraint',
  'no_predecessor',
  'size_limit',
];

const date = (minutes: number): string | null => (minutes === NONE ? null : formatXerDate(minutes));
/** Minutes as working days, to two decimal places. */
const days = (minutes: number, dayMinutes: number): number | null =>
  minutes === NONE ? null : Math.round((minutes / dayMinutes) * 100) / 100;
const changesOf = (flags: number): string[] =>
  CHANGE_BITS.filter(([bit]) => flags & bit).map(([, name]) => name);
const dayMinutesFor = (info: ScheduleInfo, calendar: number): number => {
  const last = info.calendarDayMinutes.length - 1;
  const index =
    calendar >= 0 && calendar < last
      ? calendar
      : info.defaultCalendar >= 0
        ? info.defaultCalendar
        : last;
  return info.calendarDayMinutes[index] ?? 480;
};

function ok(result: unknown): ToolOutcome {
  return { content: JSON.stringify(result), isError: false, codes: [...codesInResult(result)] };
}
function failed(message: string): ToolOutcome {
  return { content: JSON.stringify({ error: message }), isError: true, codes: [] };
}

/** The engine's own refusals are safe to show the model; anything else is a fault and is rethrown. */
function refusal(error: unknown): string | null {
  const known = error as { code?: unknown; message?: unknown } | null;
  if (
    known &&
    (known.code === 'bad-request' || known.code === 'not-loaded') &&
    typeof known.message === 'string'
  ) {
    return known.message;
  }
  return null;
}

async function searchActivities(
  engine: ToolEngine,
  input: ToolInput<'search_activities'>,
): Promise<ToolOutcome> {
  const { b: info } = await engine.request({ type: 'info' });
  if (!info) return failed('The current update is not loaded.');
  let flagsAny = 0;
  for (const kind of input.change_kinds ?? [])
    flagsAny |= CHANGE_BITS.find(([, name]) => name === kind)![0];
  const sortBy = input.sort_by ?? (input.changed_only || flagsAny ? 'finish_slip' : undefined);
  const sort =
    sortBy === 'finish_slip'
      ? ({ column: 'finishDeltaDays', direction: 'desc' } as const)
      : sortBy === 'total_float'
        ? ({ column: 'totalFloatDays', direction: 'asc' } as const)
        : sortBy
          ? ({ column: sortBy, direction: 'asc' } as const)
          : null;
  const rows = await engine.request({
    type: 'rows',
    slot: 'b',
    range: [0, input.limit ?? 20],
    columns: [
      'code',
      'name',
      'status',
      'start',
      'finish',
      'finishDelta',
      'totalFloat',
      'flags',
      'calendar',
    ],
    filter: {
      ...(input.query ? { text: input.query } : {}),
      ...(input.changed_only ? { changedOnly: true } : {}),
      ...(flagsAny ? { flagsAny } : {}),
      ...(input.critical_only ? { critical: true } : {}),
      ...(input.status ? { status: input.status.map((name) => STATUS_VALUES[name]!) } : {}),
    },
    sort,
  });
  const n = rows.numbers;
  const list = Array.from(rows.indices, (_, k) => {
    const dayMinutes = dayMinutesFor(info, n.calendar![k]!);
    return {
      code: rows.text.code![k]!,
      name: rows.text.name![k]!,
      status: STATUS_NAMES[n.status![k]!] ?? 'unknown',
      start: date(n.start![k]!),
      finish: date(n.finish![k]!),
      finish_slip_days: days(n.finishDelta![k]!, dayMinutes),
      total_float_days: days(n.totalFloat![k]!, dayMinutes),
      changes: changesOf(n.flags![k]!),
    };
  });
  const capped = capResult(
    list,
    { update: 'current', activities_in_update: rows.unfiltered },
    rows.total,
  );
  return {
    content: capped.json,
    isError: false,
    codes: list.slice(0, capped.shown).map((row) => row.code),
  };
}

function shapeActivity(detail: ActivityDetail, withLinks: boolean, linkLimit: number) {
  const link = (entry: ActivityDetail['predecessors'][number]) => ({
    task_code: entry.taskCode,
    name: entry.name,
    type: REL_NAMES[entry.type] ?? 'unknown',
    lag_days: days(entry.lagMinutes, detail.dayMinutes),
  });
  return {
    name: detail.name,
    wbs: detail.wbs,
    type: TYPE_NAMES[detail.type] ?? 'unknown',
    status: STATUS_NAMES[detail.status] ?? 'unknown',
    start: date(detail.start),
    finish: date(detail.finish),
    actual_start: date(detail.actualStart),
    actual_finish: date(detail.actualFinish),
    original_duration_days: days(detail.originalDuration, detail.dayMinutes),
    remaining_duration_days: days(detail.remainingDuration, detail.dayMinutes),
    total_float_days: days(detail.totalFloat, detail.dayMinutes),
    constraint:
      detail.constraintType === ConstraintType.None
        ? null
        : {
            type: CONSTRAINT_NAMES[detail.constraintType] ?? 'unknown',
            date: date(detail.constraintDate),
          },
    ...(withLinks
      ? {
          predecessor_count: detail.predecessorCount,
          predecessors: detail.predecessors.slice(0, linkLimit).map(link),
          successor_count: detail.successorCount,
          successors: detail.successors.slice(0, linkLimit).map(link),
        }
      : {}),
  };
}

async function getActivity(
  engine: ToolEngine,
  input: ToolInput<'get_activity'>,
): Promise<ToolOutcome> {
  const found = await engine.request({ type: 'activity', taskCode: input.task_code });
  if (!found.previous && !found.current)
    return failed(
      'There is no activity with that code in either update. Use search_activities to find the right code.',
    );
  const dayMinutes = (found.current ?? found.previous)!.dayMinutes;
  const encoder = new TextEncoder();
  // Relationships are the bulk of the result: show fewer until it fits.
  for (const linkLimit of [15, 8, 4, 0]) {
    const result = {
      code: input.task_code,
      in_previous_update: found.previous !== null,
      in_current_update: found.current !== null,
      changes: changesOf(found.flags),
      finish_slip_days: days(found.finishDelta, dayMinutes),
      start_slip_days: days(found.startDelta, dayMinutes),
      duration_change_days: days(found.durationDelta, dayMinutes),
      float_change_days: days(found.floatDelta, dayMinutes),
      current: found.current ? shapeActivity(found.current, true, linkLimit) : null,
      // The previous update's relationships are only shown when the activity is gone from the current one.
      previous: found.previous
        ? shapeActivity(found.previous, found.current === null, linkLimit)
        : null,
    };
    if (encoder.encode(JSON.stringify(result)).length <= TOOL_LIMITS.bytes || linkLimit === 0)
      return ok(result);
  }
  return failed('That activity could not be described.');
}

async function traceSlip(engine: ToolEngine, input: ToolInput<'trace_slip'>): Promise<ToolOutcome> {
  let trace: Extract<EngineResult, { type: 'trace' }>;
  try {
    trace = await engine.request({
      type: 'trace',
      taskCode: input.task_code,
      maxContributors: 15,
      maxNodes: 2000,
    });
  } catch (error) {
    const message = refusal(error);
    if (message === null) throw error;
    return failed(
      `${message} A trace needs both updates and an activity that is in the current one.`,
    );
  }
  const { b: info } = await engine.request({ type: 'info' });
  const position = new Map(Array.from(trace.nodes, (activity, at) => [activity, at] as const));
  const ends: Record<string, number> = {};
  for (const end of trace.end) {
    const name = TRACE_ENDS[end] ?? 'unknown';
    if (name !== 'driven') ends[name] = (ends[name] ?? 0) + 1;
  }
  return ok({
    task_code: input.task_code,
    name: trace.names[0] ?? '',
    slip_working_days: trace.slipMinutes === NONE ? null : trace.slipWorkingDays,
    note:
      trace.slipMinutes === NONE
        ? 'This activity is new in the current update, so it has no previous finish to compare with.'
        : 'Contributors are activities on the driving path that added delay of their own, largest first. Negative days recovered time.',
    activities_on_driving_path: trace.nodes.length,
    path_ends_at: ends,
    path_cut_short: trace.truncated,
    data_date: info ? date(info.dataDate) : null,
    contributors: trace.contributors.map((entry) => {
      const at = position.get(entry.activity)!;
      return {
        code: trace.codes[at]!,
        name: trace.names[at]!,
        cause: entry.kind,
        working_days: Math.round(entry.workingDays * 100) / 100,
      };
    }),
  });
}

async function healthSummary(
  engine: ToolEngine,
  input: ToolInput<'health_summary'>,
): Promise<ToolOutcome> {
  let health: Extract<EngineResult, { type: 'health' }>;
  try {
    health = await engine.request({
      type: 'health',
      slot: input.update === 'previous' ? 'a' : 'b',
    });
  } catch (error) {
    const message = refusal(error);
    if (message === null) throw error;
    return failed(message);
  }
  return ok({
    update: input.update,
    method:
      'DCMA 14-point assessment. Percentages are of unfinished activities or of relationships into them.',
    checks: health.checks.map((check) => ({
      id: check.id,
      name: check.name,
      value: check.value === null ? null : Math.round(check.value * 100) / 100,
      unit: check.unit,
      threshold: check.threshold,
      passes_when:
        check.limit === 'max'
          ? 'value at or below threshold'
          : check.limit === 'min'
            ? 'value at or above threshold'
            : 'reported only',
      passes: check.pass,
      counted: check.count,
      out_of: check.population,
      ...(check.note ? { note: check.note } : {}),
    })),
  });
}

async function diffSummary(engine: ToolEngine): Promise<ToolOutcome> {
  let diff: Extract<EngineResult, { type: 'diff' }>;
  try {
    diff = await engine.request({ type: 'diff' });
  } catch (error) {
    const message = refusal(error);
    if (message === null) throw error;
    return failed(`${message} A comparison needs both updates.`);
  }
  const { a, b } = await engine.request({ type: 'info' });
  const milestones = await engine.request({
    type: 'rows',
    slot: 'b',
    range: [0, 15],
    columns: ['code', 'name', 'finish', 'previousFinish', 'finishDelta', 'calendar'],
    filter: {
      types: [TaskType.StartMilestone, TaskType.FinishMilestone],
      flagsAny: Change.FinishMoved,
    },
    sort: { column: 'finishDeltaDays', direction: 'desc' },
  });
  const c = diff.counts;
  return ok({
    previous_update: { activities: diff.activitiesA, data_date: a ? date(a.dataDate) : null },
    current_update: { activities: diff.activitiesB, data_date: b ? date(b.dataDate) : null },
    activities_changed: diff.changed,
    by_kind_of_change: {
      added: c.Added,
      removed: c.Removed,
      start_moved: c.StartMoved,
      finish_moved: c.FinishMoved,
      duration_changed: c.DurationChanged,
      progressed: c.Progressed,
      constraint_changed: c.ConstraintChanged,
      logic_changed: c.LogicChanged,
      float_changed: c.FloatChanged,
      joined_critical_path: c.JoinedCriticalPath,
      left_critical_path: c.LeftCriticalPath,
    },
    relationships: {
      added: diff.relationships.added,
      removed: diff.relationships.removed,
      lag_changed: diff.relationships.lagChanged,
    },
    milestones_moved_total: milestones.total,
    milestones_moved_note:
      'The milestones whose finish moved, largest slip first. At most 15 are listed.',
    milestones_moved: Array.from(milestones.indices, (_, k) => ({
      code: milestones.text.code![k]!,
      name: milestones.text.name![k]!,
      previous_finish: date(milestones.numbers.previousFinish![k]!),
      current_finish: date(milestones.numbers.finish![k]!),
      slip_working_days: b
        ? days(
            milestones.numbers.finishDelta![k]!,
            dayMinutesFor(b, milestones.numbers.calendar![k]!),
          )
        : null,
    })),
  });
}

async function proposeEdit(
  engine: ToolEngine,
  input: ToolInput<'propose_edit'>,
): Promise<ToolOutcome> {
  const found = await engine.request({ type: 'activity', taskCode: input.task_code });
  const current = found.current;
  if (!current)
    return failed(
      'There is no activity with that code in the current update, so nothing can be proposed for it.',
    );

  let field: Proposal['field'];
  let to: number;
  let also: Proposal['also'];
  if (input.change === 'set_constraint') {
    field = 'constraintType';
    to = CONSTRAINT_VALUES[input.constraint_type!];
    if (input.constraint_type !== 'none') {
      const when = parseXerDate(input.constraint_date!);
      if (when === NONE) return failed('constraint_date is not a real date and time.');
      also = { field: 'constraintDate', to: when };
    } else if (current.constraintDate !== NONE) {
      also = { field: 'constraintDate', to: NONE };
    }
  } else {
    field = input.change === 'set_original_duration' ? 'originalDuration' : 'remainingDuration';
    to = Math.round(input.working_days! * current.dayMinutes);
  }

  // Try it without keeping it. A constraint's type and date are tried together.
  let preview: Extract<EngineResult, { type: 'applyEdit' }>;
  try {
    preview = await engine.request({
      type: 'applyEdit',
      activity: current.index,
      field,
      to,
      ...(also ? { and: also } : {}),
      preview: true,
    });
  } catch (error) {
    const message = refusal(error);
    if (message === null) throw error;
    return failed(message);
  }

  const from = preview.edit.from;
  const describe = (value: number) =>
    field === 'constraintType'
      ? value === ConstraintType.None
        ? 'none'
        : (CONSTRAINT_NAMES[value] ?? 'unknown')
      : days(value, current.dayMinutes);
  const result = {
    proposed: true,
    applied: false,
    note: 'The planner now sees this proposal and decides. Nothing in the schedule has changed.',
    task_code: input.task_code,
    name: current.name,
    change: input.change,
    from: describe(from),
    to: describe(to),
    ...(also && also.to !== NONE ? { constraint_date: date(also.to) } : {}),
    effect: {
      activities_whose_dates_move: preview.changed.length,
      project_finish_before: date(preview.projectFinishBefore),
      project_finish_after: date(preview.projectFinishAfter),
      milestones_that_move: preview.milestones.slice(0, 10).map((move) => ({
        code: move.taskCode,
        finish_before: date(move.finishBefore),
        finish_after: date(move.finishAfter),
        change_calendar_days:
          Math.round(((move.finishAfter - move.finishBefore) / 1440) * 100) / 100,
      })),
    },
  };
  return {
    ...ok(result),
    proposal: {
      taskCode: input.task_code,
      activity: current.index,
      field,
      from,
      to,
      ...(also ? { also } : {}),
      reason: input.reason,
    },
  };
}

/**
 * Runs one tool call. The input is checked again here, whatever the server
 * said about it: this is the last point before model output touches the engine.
 */
export async function runTool(
  engine: ToolEngine,
  name: unknown,
  input: unknown,
): Promise<ToolOutcome> {
  const parsed = parseToolCall(name, input);
  if (!parsed.ok) return failed(parsed.problem);
  switch (parsed.name as ToolName) {
    case 'search_activities':
      return searchActivities(engine, parsed.input as ToolInput<'search_activities'>);
    case 'get_activity':
      return getActivity(engine, parsed.input as ToolInput<'get_activity'>);
    case 'trace_slip':
      return traceSlip(engine, parsed.input as ToolInput<'trace_slip'>);
    case 'health_summary':
      return healthSummary(engine, parsed.input as ToolInput<'health_summary'>);
    case 'diff_summary':
      return diffSummary(engine);
    case 'propose_edit':
      return proposeEdit(engine, parsed.input as ToolInput<'propose_edit'>);
  }
}
