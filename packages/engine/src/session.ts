/**
 * The engine session: everything the engine worker knows and can do, as a
 * plain class with no worker APIs, so it runs and is tested in Node.
 *
 * It holds both schedules (decision D3) and answers with small results:
 * counts, and the cells for a visible range of rows. A view of the grid is
 * a filter plus a sort; the session keeps each view as one Int32Array of
 * activity indices and computes cell values only for the rows and columns
 * asked for.
 */
import { NONE, Status, stringAt, type ScheduleData } from '@slip/xer';
import { prepareClocks, runCpm, type CpmResult } from './cpm.ts';
import {
  describeActivity,
  indexOfCode,
  scheduleInfo,
  type ActivityDetail,
  type ScheduleInfo,
} from './describe.ts';
import { diffSchedules, type ChangeName, type DiffDates, type DiffResult } from './diff.ts';
import {
  changedActivities,
  invalidEdit,
  isEditField,
  milestoneMoves,
  withEdits,
  type EditField,
  type EditPatch,
} from './edits.ts';
import { runHealth, type HealthCheck } from './health/health.ts';
import { traceSlip, type TraceOptions, type TraceResult } from './trace.ts';
import { workBetween, type WorkClock } from './worktime.ts';

export type Slot = 'a' | 'b';

/** Columns whose cells are text. */
export const TEXT_COLUMNS = ['code', 'name', 'wbs'] as const;
/**
 * Columns whose cells are integers: dates and durations in minutes, enum
 * values, or a change bitmask. NONE means there is no value.
 */
export const NUMBER_COLUMNS = [
  'type',
  'status',
  'start',
  'finish',
  'previousStart',
  'previousFinish',
  'startDelta',
  'finishDelta',
  'originalDuration',
  'durationDelta',
  'remainingDuration',
  'totalFloat',
  'floatDelta',
  'constraintType',
  'constraintDate',
  'calendar',
  'flags',
  // The same four measures in hundredths of a working day on the activity's own calendar.
  // Minutes cannot be compared across calendars: a day is 480 of them on one and 1,440 on
  // another. Sort and rank by these.
  'startDeltaDays',
  'finishDeltaDays',
  'durationDeltaDays',
  'totalFloatDays',
] as const;

export type TextColumn = (typeof TEXT_COLUMNS)[number];
export type NumberColumn = (typeof NUMBER_COLUMNS)[number];
export type ColumnId = TextColumn | NumberColumn;

const isTextColumn = (column: ColumnId): column is TextColumn =>
  (TEXT_COLUMNS as readonly string[]).includes(column);
const isColumn = (column: string): column is ColumnId =>
  (TEXT_COLUMNS as readonly string[]).includes(column) ||
  (NUMBER_COLUMNS as readonly string[]).includes(column);

export interface FilterSpec {
  /** Only activities with at least one change. Needs both schedules. */
  changedOnly?: boolean;
  /** Only activities with any of these Change bits. Needs both schedules. */
  flagsAny?: number;
  /** Only activities with one of these Status values. */
  status?: number[];
  /** Only activities with total float of zero or less. */
  critical?: boolean;
  /** Only activities whose code or name contains this text. Case is ignored for A to Z. */
  text?: string;
  /** Only activities of these TaskType values, for example milestones. */
  types?: number[];
  /** Only the activities counted against this DCMA check (1 to 14). */
  healthCheck?: number;
}

export interface SortSpec {
  column: ColumnId;
  direction: 'asc' | 'desc';
}

export type EngineRequest =
  | { type: 'ping' }
  | { type: 'load'; slot: Slot; data: ScheduleData }
  | { type: 'cpm'; slot: Slot }
  | { type: 'diff' }
  | { type: 'health'; slot: Slot }
  /** Trace an activity of update B, by index or by activity code. */
  | ({ type: 'trace'; activity?: number; taskCode?: string } & TraceOptions)
  /**
   * Change one value on an activity of update B and reschedule. With `preview`, nothing is
   * kept: the result shows what would happen. `id` lets a saved edit be replayed under its own id.
   */
  | {
      type: 'applyEdit';
      activity?: number;
      taskCode?: string;
      field: EditField;
      to: number;
      /**
       * A second value on the same activity that belongs with the first, applied and reverted
       * together. A constraint is a type and a date; neither means much alone.
       */
      and?: { field: EditField; to: number };
      preview?: boolean;
      id?: string;
    }
  | { type: 'revertEdit'; editId: string }
  | { type: 'edits' }
  /** What is loaded: project, data date, counts and calendars, per update. */
  | { type: 'info' }
  /** One activity by exact code, in both updates, with its relationships and what changed. */
  | { type: 'activity'; taskCode: string }
  | {
      type: 'rows';
      slot: Slot;
      /** First row and one past the last row, in the filtered and sorted view. */
      range: [number, number];
      columns: ColumnId[];
      filter?: FilterSpec;
      sort?: SortSpec | null;
    };

export interface LoadResult {
  slot: Slot;
  activities: number;
  relationships: number;
  version: number;
}

export interface CpmSummary {
  slot: Slot;
  projectFinish: number;
  dataDate: number;
  /** Activities with total float of zero or less. */
  critical: number;
  loopActivities: number;
  ignoredRelationships: number;
  /** Activities whose recalculated early finish differs from the date stored in the file. */
  differsFromFile: number;
}

export interface DiffSummary {
  counts: Record<ChangeName, number>;
  changed: number;
  activitiesA: number;
  activitiesB: number;
  relationships: { added: number; removed: number; lagChanged: number };
}

export interface RowsResult {
  slot: Slot;
  /** The range actually returned, clamped to the view. */
  range: [number, number];
  /** Rows in the view after filtering. */
  total: number;
  /** Activities in the schedule before filtering; `unfiltered - total` are hidden. */
  unfiltered: number;
  /** Activity index of each returned row. */
  indices: Int32Array;
  text: Partial<Record<TextColumn, string[]>>;
  numbers: Partial<Record<NumberColumn, Int32Array>>;
}

/** A health check without its list of activities; ask for those with a `rows` request and the `healthCheck` filter. */
export type HealthSummary = Omit<HealthCheck, 'offenders'>;

export interface TraceSummary extends TraceResult {
  /** Activity code and name for each entry of `nodes`, so a small view needs no second request. */
  codes: string[];
  names: string[];
}

export interface EditResult {
  /** The edit as applied. For a preview or a revert, the edit that was tried or removed. */
  edit: EditPatch;
  /** False for a preview: the schedule is as it was. */
  applied: boolean;
  /** Activities whose dates or float changed, in index order. */
  changed: Int32Array;
  projectFinishBefore: number;
  projectFinishAfter: number;
  /** Milestones whose date moved, the biggest move first, with their codes. At most 50. */
  milestones: {
    activity: number;
    taskCode: string;
    finishBefore: number;
    finishAfter: number;
    /** The move in working days on the milestone's own calendar. Negative is earlier. */
    workingDays: number;
  }[];
  /** Edits in force after this request. */
  editCount: number;
}

export type EngineResult =
  | { type: 'ping' }
  | ({ type: 'load' } & LoadResult)
  | ({ type: 'cpm' } & CpmSummary)
  | ({ type: 'diff' } & DiffSummary)
  | { type: 'health'; slot: Slot; checks: HealthSummary[] }
  | ({ type: 'trace' } & TraceSummary)
  | ({ type: 'applyEdit' } & EditResult)
  | ({ type: 'revertEdit' } & EditResult)
  | { type: 'edits'; edits: EditPatch[] }
  | { type: 'info'; a: ScheduleInfo | null; b: ScheduleInfo | null }
  | {
      type: 'activity';
      taskCode: string;
      previous: ActivityDetail | null;
      current: ActivityDetail | null;
      /** Change bits for the activity in the current update; 0 if unchanged or not comparable. */
      flags: number;
      /** Finish slip in working minutes on its own calendar, or NONE. */
      finishDelta: number;
      startDelta: number;
      durationDelta: number;
      floatDelta: number;
    }
  | ({ type: 'rows' } & RowsResult);

export type EngineErrorCode = 'not-loaded' | 'bad-request' | 'out-of-memory' | 'failed';

export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

interface Loaded {
  /** The schedule with edits applied. The same object as `base` while there are none. */
  data: ScheduleData;
  /** The schedule exactly as imported. Never changed. */
  base: ScheduleData;
  /** Edits in force, oldest first. Only update B is edited. */
  edits: EditPatch[];
  clocks: WorkClock[];
  cpm: CpmResult | null;
  /** Goes up whenever the schedule or its dates change. Cached views are tied to it. */
  version: number;
  /** Whole-schedule number columns built for sorting, by column. */
  columnCache: Map<NumberColumn, Int32Array>;
  /** DCMA checks for the current version, once asked for. */
  health: HealthCheck[] | null;
}

interface CachedView {
  key: string;
  indices: Int32Array;
}

/** The most typed-array memory cached views may hold before the least recently used are dropped. */
const VIEW_CACHE_BYTES = 64 * 1024 * 1024;
const MAX_ROWS_PER_REQUEST = 2000;

export class EngineSession {
  private readonly slots: Record<Slot, Loaded | null> = { a: null, b: null };
  private diff: DiffResult | null = null;
  private versionCounter = 0;
  private editCounter = 0;
  /** Most recently used last. */
  private views: CachedView[] = [];

  handle(request: EngineRequest): EngineResult {
    try {
      switch (request.type) {
        case 'ping':
          return { type: 'ping' };
        case 'load':
          return { type: 'load', ...this.load(request.slot, request.data) };
        case 'cpm':
          return { type: 'cpm', ...this.cpm(request.slot) };
        case 'diff':
          return { type: 'diff', ...this.diffSummary() };
        case 'health':
          return {
            type: 'health',
            slot: request.slot,
            checks: this.health(request.slot).map((check) => {
              const summary: Partial<HealthCheck> = { ...check };
              delete summary.offenders;
              return summary as HealthSummary;
            }),
          };
        case 'trace':
          return { type: 'trace', ...this.trace(request) };
        case 'applyEdit':
          return { type: 'applyEdit', ...this.applyEdit(request) };
        case 'revertEdit':
          return { type: 'revertEdit', ...this.revertEdit(request.editId) };
        case 'info':
          return { type: 'info', a: this.info('a'), b: this.info('b') };
        case 'activity':
          return { type: 'activity', ...this.activity(request.taskCode) };
        case 'edits':
          return { type: 'edits', edits: this.need('b').edits.map((edit) => ({ ...edit })) };
        case 'rows':
          return { type: 'rows', ...this.rows(request) };
        default:
          throw new EngineError('bad-request', 'Unknown request.');
      }
    } catch (error) {
      if (error instanceof EngineError) throw error;
      if (error instanceof RangeError) {
        throw new EngineError(
          'out-of-memory',
          'There was not enough memory, or a date fell outside the range the engine can schedule.',
        );
      }
      throw new EngineError('failed', 'The engine could not complete the request.');
    }
  }

  /** Buffers in a result that can be transferred instead of copied. */
  static transferList(result: EngineResult): ArrayBuffer[] {
    if (result.type === 'trace') {
      return [
        result.nodes,
        result.depth,
        result.end,
        result.edgePred,
        result.edgeSucc,
        result.edgeType,
        result.edgeLag,
      ].map((array) => array.buffer as ArrayBuffer);
    }
    if (result.type === 'applyEdit' || result.type === 'revertEdit')
      return [result.changed.buffer as ArrayBuffer];
    if (result.type !== 'rows') return [];
    const buffers = [result.indices.buffer as ArrayBuffer];
    for (const column of Object.values(result.numbers)) buffers.push(column.buffer as ArrayBuffer);
    return buffers;
  }

  private need(slot: Slot): Loaded {
    const loaded = this.slots[slot];
    if (!loaded) throw new EngineError('not-loaded', `Update ${slot.toUpperCase()} is not loaded.`);
    return loaded;
  }

  private load(slot: Slot, data: ScheduleData): LoadResult {
    if (slot !== 'a' && slot !== 'b') throw new EngineError('bad-request', 'Unknown update.');
    const version = ++this.versionCounter;
    this.slots[slot] = {
      data,
      base: data,
      edits: [],
      clocks: prepareClocks(data),
      cpm: null,
      version,
      columnCache: new Map(),
      health: null,
    };
    this.diff = null;
    this.views = [];
    return { slot, activities: data.n, relationships: data.meta.relationshipCount, version };
  }

  private cpm(slot: Slot): CpmSummary {
    const loaded = this.need(slot);
    const result = runCpm(loaded.data, loaded.clocks);
    loaded.cpm = result;
    loaded.version = ++this.versionCounter;
    loaded.columnCache.clear();
    loaded.health = null;
    this.diff = null;
    this.views = [];
    let critical = 0;
    let differsFromFile = 0;
    for (let i = 0; i < loaded.data.n; i++) {
      if (result.totalFloat[i] !== NONE && result.totalFloat[i]! <= 0) critical++;
      if (result.earlyFinish[i] !== loaded.data.earlyFinish[i]) differsFromFile++;
    }
    return {
      slot,
      projectFinish: result.projectFinish,
      dataDate: result.dataDate,
      critical,
      loopActivities: result.loopActivities.length,
      ignoredRelationships: result.ignoredRelationships,
      differsFromFile,
    };
  }

  /** Recalculated dates if CPM has run for the slot, otherwise the dates stored in the file. */
  private dates(loaded: Loaded): DiffDates {
    return loaded.cpm
      ? {
          earlyStart: loaded.cpm.earlyStart,
          earlyFinish: loaded.cpm.earlyFinish,
          totalFloat: loaded.cpm.totalFloat,
        }
      : {
          earlyStart: loaded.data.earlyStart,
          earlyFinish: loaded.data.earlyFinish,
          totalFloat: loaded.data.totalFloatMin,
        };
  }

  private ensureDiff(): DiffResult {
    if (!this.diff) {
      const a = this.need('a');
      const b = this.need('b');
      this.diff = diffSchedules(a.data, b.data, b.clocks, this.dates(a), this.dates(b));
    }
    return this.diff;
  }

  private health(slot: Slot): HealthCheck[] {
    const loaded = this.need(slot);
    loaded.health ??= runHealth(loaded.data, loaded.clocks, this.dates(loaded));
    return loaded.health;
  }

  private trace(request: Extract<EngineRequest, { type: 'trace' }>): TraceSummary {
    const a = this.need('a');
    const b = this.need('b');
    const target = this.findActivity(b.data, request.activity, request.taskCode);
    const limit = (value: number | undefined, most: number) =>
      value === undefined ? undefined : Math.max(1, Math.min(most, Math.floor(value) || 1));
    const result = traceSlip(
      a.data,
      b.data,
      this.ensureDiff(),
      a.clocks,
      b.clocks,
      this.dates(a),
      this.dates(b),
      target,
      {
        maxNodes: limit(request.maxNodes, 5000),
        maxDepth: limit(request.maxDepth, 100_000),
        maxContributors: limit(request.maxContributors, 1000),
      },
    );
    return {
      ...result,
      codes: Array.from(result.nodes, (j) => stringAt(b.data.strings, b.data.taskCode[j]!)),
      names: Array.from(result.nodes, (j) => stringAt(b.data.strings, b.data.taskName[j]!)),
    };
  }

  private findActivity(
    data: ScheduleData,
    activity: number | undefined,
    taskCode: string | undefined,
  ): number {
    let found = activity ?? -1;
    if (taskCode !== undefined) {
      found = -1;
      for (let j = 0; j < data.n; j++) {
        if (stringAt(data.strings, data.taskCode[j]!) === taskCode) {
          found = j;
          break;
        }
      }
    }
    if (!Number.isInteger(found) || found < 0 || found >= data.n) {
      throw new EngineError('bad-request', 'That activity is not in the current update.');
    }
    return found;
  }

  /**
   * Puts a set of edits in force on update B (or only tries them, for a preview) and
   * reports what moved. The comparison is always between two of our own CPM runs, never
   * with the dates in the file, so the result shows the edit and nothing else.
   */
  private reschedule(edits: EditPatch[], subject: EditPatch, keep: boolean): EditResult {
    const b = this.need('b');
    const before = b.cpm ?? runCpm(b.data, b.clocks);
    const data = withEdits(b.base, edits);
    const after = runCpm(data, b.clocks);
    const changed = changedActivities(before, after);
    const fallbackClock = b.clocks.length - 1;
    const usualClock =
      data.calendars.defaultIndex >= 0 ? data.calendars.defaultIndex : fallbackClock;
    const milestones = milestoneMoves(data, before, after, changed).map((move) => {
      const index = data.calendarIndex[move.activity]!;
      const clock = b.clocks[index >= 0 && index < fallbackClock ? index : usualClock]!;
      const minutes = workBetween(clock, move.finishBefore, move.finishAfter);
      return {
        ...move,
        taskCode: stringAt(data.strings, data.taskCode[move.activity]!),
        workingDays: Math.round((minutes / (clock.calendar.dayMinutes || 480)) * 100) / 100,
      };
    });
    if (keep) {
      b.data = data;
      b.edits = edits;
      b.cpm = after;
      b.version = ++this.versionCounter;
      b.columnCache.clear();
      b.health = null;
      this.diff = null;
      this.views = [];
    } else if (!b.cpm) {
      // A preview still leaves update B on recalculated dates, so the next comparison is like for like.
      b.cpm = before;
      b.version = ++this.versionCounter;
      b.columnCache.clear();
      b.health = null;
      this.diff = null;
      this.views = [];
    }
    return {
      edit: { ...subject },
      applied: keep,
      changed,
      projectFinishBefore: before.projectFinish,
      projectFinishAfter: after.projectFinish,
      milestones,
      editCount: b.edits.length,
    };
  }

  private applyEdit(request: Extract<EngineRequest, { type: 'applyEdit' }>): EditResult {
    const b = this.need('b');
    if (!isEditField(request.field))
      throw new EngineError('bad-request', 'That field cannot be edited.');
    const activity = this.findActivity(b.data, request.activity, request.taskCode);
    const problem = invalidEdit(b.data, activity, request.field, request.to);
    if (problem) throw new EngineError('bad-request', problem);
    if (
      request.id !== undefined &&
      (typeof request.id !== 'string' || b.edits.some((edit) => edit.id === request.id))
    ) {
      throw new EngineError('bad-request', 'That edit id is already in use.');
    }
    const columns = {
      originalDuration: b.data.originalDurationMin,
      remainingDuration: b.data.remainingDurationMin,
      constraintType: b.data.constraintType,
      constraintDate: b.data.constraintDate,
    };
    const taskCode = stringAt(b.data.strings, b.data.taskCode[activity]!);
    const patch: EditPatch = {
      id: request.id ?? `edit-${++this.editCounter}`,
      activity,
      taskCode,
      field: request.field,
      from: columns[request.field][activity]!,
      to: request.to,
    };
    const patches = [patch];
    if (request.and !== undefined) {
      const second = request.and;
      if (
        second === null ||
        typeof second !== 'object' ||
        !isEditField(second.field) ||
        second.field === request.field
      ) {
        throw new EngineError(
          'bad-request',
          'The second value must be a different editable field.',
        );
      }
      const secondProblem = invalidEdit(b.data, activity, second.field, second.to);
      if (secondProblem) throw new EngineError('bad-request', secondProblem);
      // Its id ties it to the first, so reverting one reverts both.
      patches.push({
        id: `${patch.id}:and`,
        activity,
        taskCode,
        field: second.field,
        from: columns[second.field][activity]!,
        to: second.to,
      });
    }
    return this.reschedule([...b.edits, ...patches], patch, request.preview !== true);
  }

  private revertEdit(editId: string): EditResult {
    const b = this.need('b');
    const edit = b.edits.find((entry) => entry.id === editId);
    if (!edit) throw new EngineError('bad-request', 'There is no such edit to revert.');
    return this.reschedule(
      b.edits.filter((entry) => entry.id !== editId && entry.id !== `${editId}:and`),
      edit,
      true,
    );
  }

  private dayMinutes(loaded: Loaded): (i: number) => number {
    const fallback = loaded.clocks.length - 1;
    const usual =
      loaded.data.calendars.defaultIndex >= 0 ? loaded.data.calendars.defaultIndex : fallback;
    return (i) => {
      const index = loaded.data.calendarIndex[i]!;
      return (
        loaded.clocks[index >= 0 && index < fallback ? index : usual]!.calendar.dayMinutes || 480
      );
    };
  }

  private info(slot: Slot): ScheduleInfo | null {
    const loaded = this.slots[slot];
    if (!loaded) return null;
    return scheduleInfo(
      loaded.data,
      loaded.clocks.map((clock) => clock.calendar.dayMinutes || 480),
      loaded.cpm !== null,
      loaded.edits.length,
    );
  }

  private activity(taskCode: unknown) {
    if (typeof taskCode !== 'string' || taskCode.length === 0 || taskCode.length > 200) {
      throw new EngineError('bad-request', 'An activity code is needed.');
    }
    const a = this.slots.a;
    const b = this.slots.b;
    if (!a && !b) throw new EngineError('not-loaded', 'No schedule is loaded.');
    const inB = b ? indexOfCode(b.data, taskCode) : -1;
    const diff = a && b ? this.ensureDiff() : null;
    // Prefer the match the diff made, so duplicates resolve the same way everywhere.
    const inA = a ? (diff && inB >= 0 ? diff.matchA[inB]! : indexOfCode(a.data, taskCode)) : -1;
    const comparable = diff !== null && inB >= 0 && inA >= 0;
    return {
      taskCode,
      previous:
        a && inA >= 0 ? describeActivity(a.data, this.dates(a), this.dayMinutes(a), inA) : null,
      current:
        b && inB >= 0 ? describeActivity(b.data, this.dates(b), this.dayMinutes(b), inB) : null,
      flags: diff && inB >= 0 ? diff.flags[inB]! : 0,
      finishDelta: comparable ? diff.finishDelta[inB]! : NONE,
      startDelta: comparable ? diff.startDelta[inB]! : NONE,
      durationDelta: comparable ? diff.durationDelta[inB]! : NONE,
      floatDelta: comparable ? diff.floatDelta[inB]! : NONE,
    };
  }

  private diffSummary(): DiffSummary {
    const diff = this.ensureDiff();
    return {
      counts: diff.counts,
      changed: diff.changed,
      activitiesA: this.need('a').data.n,
      activitiesB: this.need('b').data.n,
      relationships: diff.relationships,
    };
  }

  /**
   * A whole number column for one slot. Most are the schedule's own arrays;
   * the rest are built once per schedule version and kept.
   */
  private numberColumn(
    slot: Slot,
    column: NumberColumn,
  ): Int32Array | Uint8Array | Int16Array | Uint16Array {
    const loaded = this.need(slot);
    const { data } = loaded;
    switch (column) {
      case 'type':
        return data.type;
      case 'status':
        return data.status;
      case 'originalDuration':
        return data.originalDurationMin;
      case 'remainingDuration':
        return data.remainingDurationMin;
      case 'constraintType':
        return data.constraintType;
      case 'constraintDate':
        return data.constraintDate;
      case 'calendar':
        return data.calendarIndex;
      case 'totalFloat':
        return this.dates(loaded).totalFloat;
    }
    const cached = loaded.columnCache.get(column);
    if (cached) return cached;
    const built = this.buildColumn(slot, loaded, column);
    loaded.columnCache.set(column, built);
    return built;
  }

  private buildColumn(slot: Slot, loaded: Loaded, column: NumberColumn): Int32Array {
    const { data } = loaded;
    const n = data.n;
    const out = new Int32Array(n).fill(NONE);
    const dates = this.dates(loaded);
    if (column === 'start' || column === 'finish') {
      const actual = column === 'start' ? data.actualStart : data.actualFinish;
      const early = column === 'start' ? dates.earlyStart : dates.earlyFinish;
      for (let i = 0; i < n; i++) out[i] = actual[i] !== NONE ? actual[i]! : early[i]!;
      return out;
    }
    const inDays: Partial<Record<NumberColumn, NumberColumn>> = {
      startDeltaDays: 'startDelta',
      finishDeltaDays: 'finishDelta',
      durationDeltaDays: 'durationDelta',
      totalFloatDays: 'totalFloat',
    };
    const minutesColumn = inDays[column];
    if (minutesColumn) {
      const minutes = this.numberColumn(slot, minutesColumn);
      const dayMinutes = this.dayMinutes(loaded);
      for (let i = 0; i < n; i++) {
        if (minutes[i] !== NONE) out[i] = Math.round((minutes[i]! * 100) / dayMinutes(i));
      }
      return out;
    }
    // Everything else compares with the previous update, so it only exists for update B.
    if (slot !== 'b' || !this.slots.a) return out;
    const diff = this.ensureDiff();
    switch (column) {
      case 'startDelta':
        return diff.startDelta;
      case 'finishDelta':
        return diff.finishDelta;
      case 'durationDelta':
        return diff.durationDelta;
      case 'floatDelta':
        return diff.floatDelta;
      case 'flags':
        out.set(diff.flags);
        return out;
      case 'previousStart':
      case 'previousFinish': {
        const previous = this.numberColumn('a', column === 'previousStart' ? 'start' : 'finish');
        for (let j = 0; j < n; j++) {
          const i = diff.matchA[j]!;
          if (i >= 0) out[j] = previous[i]!;
        }
        return out;
      }
    }
    return out;
  }

  private textAt(data: ScheduleData, column: TextColumn, i: number): string {
    if (column === 'code') return stringAt(data.strings, data.taskCode[i]!);
    if (column === 'name') return stringAt(data.strings, data.taskName[i]!);
    const node = data.wbsIndex[i]!;
    return node < 0 ? '' : stringAt(data.strings, data.wbs.code[node]!);
  }

  /** The string id that a text column sorts and searches by, for one activity. -1 if there is none. */
  private stringId(data: ScheduleData, column: TextColumn, i: number): number {
    if (column === 'code') return data.taskCode[i]!;
    if (column === 'name') return data.taskName[i]!;
    const node = data.wbsIndex[i]!;
    return node < 0 ? -1 : data.wbs.code[node]!;
  }

  private view(slot: Slot, filter: FilterSpec, sort: SortSpec | null): Int32Array {
    const loaded = this.need(slot);
    const other = this.slots[slot === 'a' ? 'b' : 'a'];
    const key = `${slot}|${loaded.version}|${other?.version ?? 0}|${JSON.stringify(filter)}|${JSON.stringify(sort)}`;
    const hit = this.views.findIndex((view) => view.key === key);
    if (hit >= 0) {
      const [view] = this.views.splice(hit, 1);
      this.views.push(view!);
      return view!.indices;
    }
    const indices = this.sorted(slot, loaded, this.filtered(slot, loaded, filter), sort);
    this.views.push({ key, indices });
    let bytes = this.views.reduce((total, view) => total + view.indices.byteLength, 0);
    while (bytes > VIEW_CACHE_BYTES && this.views.length > 1)
      bytes -= this.views.shift()!.indices.byteLength;
    return indices;
  }

  private filtered(slot: Slot, loaded: Loaded, filter: FilterSpec): Int32Array {
    const { data } = loaded;
    const n = data.n;
    const flagMask = filter.changedOnly ? 0xffff : (filter.flagsAny ?? 0);
    const flags = flagMask !== 0 && slot === 'b' && this.slots.a ? this.ensureDiff().flags : null;
    if (flagMask !== 0 && !flags) return new Int32Array(0); // nothing to compare against
    const statuses = filter.status && filter.status.length > 0 ? new Set(filter.status) : null;
    const float = filter.critical ? this.dates(loaded).totalFloat : null;
    const types = filter.types && filter.types.length > 0 ? new Set(filter.types) : null;
    let inCheck: Uint8Array | null = null;
    if (filter.healthCheck !== undefined) {
      const check = this.health(slot).find((entry) => entry.id === filter.healthCheck);
      if (!check) throw new EngineError('bad-request', 'Unknown health check.');
      inCheck = new Uint8Array(n);
      for (const i of check.offenders) inCheck[i] = 1;
    }
    const needle = filter.text ? asciiLower(new TextEncoder().encode(filter.text)) : null;

    const out = new Int32Array(n);
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (flags && (flags[i]! & flagMask) === 0) continue;
      if (inCheck && !inCheck[i]) continue;
      if (types && !types.has(data.type[i]!)) continue;
      if (statuses && !statuses.has(data.status[i]!)) continue;
      if (float && (float[i] === NONE || float[i]! > 0 || data.status[i] === Status.Complete))
        continue;
      if (
        needle &&
        needle.length > 0 &&
        !containsBytes(data, data.taskCode[i]!, needle) &&
        !containsBytes(data, data.taskName[i]!, needle)
      ) {
        continue;
      }
      out[count++] = i;
    }
    return out.slice(0, count);
  }

  private sorted(
    slot: Slot,
    loaded: Loaded,
    indices: Int32Array,
    sort: SortSpec | null,
  ): Int32Array {
    if (!sort) return indices;
    if (!isColumn(sort.column)) throw new EngineError('bad-request', 'Unknown sort column.');
    const sign = sort.direction === 'desc' ? -1 : 1;
    const { data } = loaded;
    if (isTextColumn(sort.column)) {
      const column = sort.column;
      const { bytes, offsets } = data.strings;
      // Compares the UTF-8 bytes in place: no string is decoded to sort a million rows.
      return indices.sort((x, y) => {
        const p = this.stringId(data, column, x);
        const q = this.stringId(data, column, y);
        if (p === q) return x - y;
        if (p < 0) return 1;
        if (q < 0) return -1;
        let at = offsets[p]!;
        let bt = offsets[q]!;
        const aEnd = offsets[p + 1]!;
        const bEnd = offsets[q + 1]!;
        while (at < aEnd && bt < bEnd) {
          const difference = bytes[at++]! - bytes[bt++]!;
          if (difference !== 0) return sign * difference;
        }
        const lengths = aEnd - at - (bEnd - bt);
        return lengths !== 0 ? sign * lengths : x - y;
      });
    }
    const values = this.numberColumn(slot, sort.column);
    // Activities with no value sort last in both directions; ties keep file order.
    return indices.sort((x, y) => {
      const p = values[x]!;
      const q = values[y]!;
      if (p === q) return x - y;
      if (p === NONE) return 1;
      if (q === NONE) return -1;
      return p < q ? -sign : sign;
    });
  }

  private rows(request: Extract<EngineRequest, { type: 'rows' }>): RowsResult {
    const { slot, columns } = request;
    const loaded = this.need(slot);
    if (!Array.isArray(columns) || !columns.every(isColumn))
      throw new EngineError('bad-request', 'Unknown column.');
    const [from, to] = request.range;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) {
      throw new EngineError('bad-request', 'The row range is not valid.');
    }
    const view = this.view(slot, request.filter ?? {}, request.sort ?? null);
    const start = Math.min(from, view.length);
    const end = Math.min(to, view.length, start + MAX_ROWS_PER_REQUEST);
    const indices = view.slice(start, end);
    const text: RowsResult['text'] = {};
    const numbers: RowsResult['numbers'] = {};
    for (const column of columns) {
      if (isTextColumn(column)) {
        text[column] = Array.from(indices, (i) => this.textAt(loaded.data, column, i));
      } else {
        const source = this.numberColumn(slot, column);
        const out = new Int32Array(indices.length);
        for (let k = 0; k < indices.length; k++) out[k] = source[indices[k]!]!;
        numbers[column] = out;
      }
    }
    return {
      slot,
      range: [start, end],
      total: view.length,
      unfiltered: loaded.data.n,
      indices,
      text,
      numbers,
    };
  }
}

function asciiLower(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]!;
    out[i] = byte >= 65 && byte <= 90 ? byte + 32 : byte;
  }
  return out;
}

/** Whether string `id` in the schedule's string table contains `needle`, ignoring case for A to Z. */
function containsBytes(data: ScheduleData, id: number, needle: Uint8Array): boolean {
  const { bytes, offsets } = data.strings;
  const start = offsets[id]!;
  const last = offsets[id + 1]! - needle.length;
  const first = needle[0]!;
  for (let at = start; at <= last; at++) {
    let byte = bytes[at]!;
    if (byte >= 65 && byte <= 90) byte += 32;
    if (byte !== first) continue;
    let k = 1;
    for (; k < needle.length; k++) {
      let next = bytes[at + k]!;
      if (next >= 65 && next <= 90) next += 32;
      if (next !== needle[k]) break;
    }
    if (k === needle.length) return true;
  }
  return false;
}
