/**
 * Streaming XER parser. Feed it decoded text in chunks of any size with
 * `push`, then call `finish` for the columnar ScheduleData.
 *
 * It never holds the whole file: each line is handled as it completes and
 * only the values we use are kept, in growable typed arrays. Problems in the
 * file become counted warnings; the only thrown error is a file that is not
 * XER at all. See docs/spec/import-robustness.md.
 */
import { parseCalendar, type Calendar } from './calendar.ts';
import { Int32Builder, StringTableBuilder, Uint8Builder } from './columns.ts';
import { EPOCH, NONE, parseHoursAsMinutes, parseXerDate } from './dates.ts';
import {
  CONSTRAINT_CODES,
  ConstraintType,
  FORMAT_VERSION,
  REL_TYPE_CODES,
  RelType,
  STATUS_CODES,
  Status,
  TASK_TYPE_CODES,
  TaskType,
  type ImportWarning,
  type ProjectInfo,
  type ScheduleData,
  type WarningKind,
} from './types.ts';

export type XerErrorCode = 'not-xer' | 'empty';

export class XerError extends Error {
  readonly code: XerErrorCode;

  constructor(code: XerErrorCode, message: string) {
    super(message);
    this.name = 'XerError';
    this.code = code;
  }
}

export interface ParseOptions {
  /** Which project to read when the file holds several. Defaults to the first one. */
  projectId?: number;
}

const MAX_EXAMPLES = 20;
const TAB = '\t';

/** Maps the field names we want to their position in a `%R` row (0 is the "%R" marker itself). */
class Fields {
  private readonly positions = new Map<string, number>();

  constructor(header: string[]) {
    for (let i = 1; i < header.length; i++) this.positions.set(header[i]!.trim(), i);
  }

  /** Position of a field, or -1 if the table does not have it. */
  of(name: string): number {
    return this.positions.get(name) ?? -1;
  }
}

function cell(parts: string[], position: number): string {
  return position < 0 ? '' : (parts[position] ?? '');
}

function int(text: string): number {
  if (text === '') return -1;
  const value = Number(text);
  return Number.isInteger(value) ? value : -1;
}

export class XerParser {
  private readonly options: ParseOptions;
  private carry = '';
  private sawHeader = false;
  private ended = false;
  private lineNumber = 0;

  private table = '';
  private fields: Fields | null = null;
  private fieldCount = 0;
  private wanted = false;

  private readonly warnings = new Map<WarningKind, ImportWarning>();
  private readonly strings = new StringTableBuilder();

  // PROJECT
  private readonly projects: ProjectInfo[] = [];
  private readonly projectDefaultCalendar = new Map<number, number>();
  private selectedProject = -1;
  private readonly schedulingOptions = new Map<number, Record<string, string>>();
  private scheduleOptionNames: string[] = [];

  // CALENDAR
  private readonly calendars: Calendar[] = [];

  // PROJWBS (raw ids; resolved in finish)
  private readonly wbsId = new Int32Builder();
  private readonly wbsParentId = new Int32Builder();
  private readonly wbsCode = new Int32Builder();
  private readonly wbsName = new Int32Builder();
  private readonly wbsOrder = new Int32Builder();

  // TASK
  private readonly taskId = new Int32Builder();
  private readonly taskWbsId = new Int32Builder();
  private readonly taskCalendarId = new Int32Builder();
  private readonly taskCode = new Int32Builder();
  private readonly taskName = new Int32Builder();
  private readonly type = new Uint8Builder();
  private readonly status = new Uint8Builder();
  private readonly earlyStart = new Int32Builder();
  private readonly earlyFinish = new Int32Builder();
  private readonly lateStart = new Int32Builder();
  private readonly lateFinish = new Int32Builder();
  private readonly actualStart = new Int32Builder();
  private readonly actualFinish = new Int32Builder();
  private readonly targetStart = new Int32Builder();
  private readonly targetFinish = new Int32Builder();
  private readonly originalDuration = new Int32Builder();
  private readonly remainingDuration = new Int32Builder();
  private readonly totalFloat = new Int32Builder();
  private readonly freeFloat = new Int32Builder();
  private readonly constraintType = new Uint8Builder();
  private readonly constraintDate = new Int32Builder();
  private readonly seenCodes = new Set<string>();
  /** Task ids that belong to other projects in the file, to tell external links from broken ones. */
  private readonly otherProjectTasks = new Set<number>();

  // TASKPRED (raw task ids; resolved in finish)
  private readonly relSucc = new Int32Builder();
  private readonly relPred = new Int32Builder();
  private readonly relType = new Uint8Builder();
  private readonly relLag = new Int32Builder();

  // Field positions for the current table, looked up once per `%F` line.
  private p: Record<string, number> = {};

  /** Rows read from the tables we use, for progress reporting. */
  rowsParsed = 0;

  constructor(options: ParseOptions = {}) {
    this.options = options;
  }

  /** Feeds the next piece of decoded text. Chunks may split lines anywhere. */
  push(chunk: string): void {
    if (this.ended || chunk === '') return;
    const text = this.carry === '' ? chunk : this.carry + chunk;
    let start = 0;
    for (;;) {
      const end = text.indexOf('\n', start);
      if (end < 0) break;
      const line =
        end > start && text.charCodeAt(end - 1) === 13
          ? text.slice(start, end - 1)
          : text.slice(start, end);
      start = end + 1;
      this.line(line);
      if (this.ended) {
        this.carry = '';
        return;
      }
    }
    this.carry = start === 0 ? text : text.slice(start);
  }

  /** Call once after the last chunk. Resolves ids to indices and builds the relationship arrays. */
  finish(): ScheduleData {
    if (!this.ended && this.carry !== '') {
      const last = this.carry.endsWith('\r') ? this.carry.slice(0, -1) : this.carry;
      this.carry = '';
      this.line(last);
    }
    if (!this.sawHeader) throw new XerError('empty', 'The file is empty.');
    if (!this.ended) this.warn('truncated-file', 'no %E end marker');
    return this.build();
  }

  private warn(kind: WarningKind, example: string): void {
    let entry = this.warnings.get(kind);
    if (!entry) {
      entry = { kind, count: 0, examples: [] };
      this.warnings.set(kind, entry);
    }
    entry.count++;
    if (entry.examples.length < MAX_EXAMPLES) entry.examples.push(example);
  }

  private line(raw: string): void {
    this.lineNumber++;
    if (!this.sawHeader) {
      // Tolerate a byte order mark and blank lines before the header.
      const first = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
      if (first.trim() === '') return;
      if (!first.startsWith('ERMHDR')) {
        throw new XerError(
          'not-xer',
          'This does not look like a Primavera XER file: it should start with "ERMHDR".',
        );
      }
      this.sawHeader = true;
      return;
    }
    if (raw.charCodeAt(0) !== 37 /* % */) {
      // A line break inside a text field. We keep none of the multi-line fields.
      if (this.wanted && raw !== '') this.warn('continuation-line', `line ${this.lineNumber}`);
      return;
    }
    const marker = raw.charCodeAt(1);
    if (marker === 82 /* R */) {
      if (!this.wanted || !this.fields) return;
      const parts = raw.split(TAB);
      if (parts.length !== this.fieldCount) {
        this.warn('row-field-count', `${this.table} line ${this.lineNumber}`);
      }
      this.rowsParsed++;
      this.row(parts);
    } else if (marker === 84 /* T */) {
      this.table = raw.slice(2).trim();
      this.fields = null;
      this.wanted = TABLES.has(this.table);
    } else if (marker === 70 /* F */) {
      if (!this.wanted) return;
      const header = raw.split(TAB);
      this.fields = new Fields(header);
      this.fieldCount = header.length;
      this.prepare(header);
    } else if (marker === 69 /* E */) {
      this.ended = true;
    }
  }

  /** Looks up the positions of the fields we use in the table that just started. */
  private prepare(header: string[]): void {
    const fields = this.fields!;
    const names = FIELDS[this.table] ?? [];
    this.p = {};
    for (const name of names) {
      const position = fields.of(name);
      this.p[name] = position;
      if (position < 0 && REQUIRED[this.table]?.includes(name)) {
        this.warn('missing-field', `${this.table}.${name}`);
      }
    }
    if (this.table === 'SCHEDOPTIONS') this.scheduleOptionNames = header.map((h) => h.trim());
  }

  private isSelected(projectId: number): boolean {
    if (this.selectedProject < 0) {
      this.selectedProject = this.options.projectId ?? projectId;
    }
    return projectId === this.selectedProject;
  }

  private date(text: string, context: string): number {
    const value = parseXerDate(text);
    if (value === NONE && text !== '') this.warn('invalid-date', context);
    return value;
  }

  private row(parts: string[]): void {
    const p = this.p;
    switch (this.table) {
      case 'PROJECT': {
        const id = int(cell(parts, p.proj_id!));
        this.projects.push({
          id,
          name: cell(parts, p.proj_short_name!),
          dataDate: this.date(cell(parts, p.last_recalc_date!), 'PROJECT.last_recalc_date'),
          planStart: this.date(cell(parts, p.plan_start_date!), 'PROJECT.plan_start_date'),
        });
        this.projectDefaultCalendar.set(id, int(cell(parts, p.clndr_id!)));
        this.isSelected(id);
        return;
      }
      case 'SCHEDOPTIONS': {
        const record: Record<string, string> = {};
        for (let i = 1; i < this.scheduleOptionNames.length; i++) {
          record[this.scheduleOptionNames[i]!] = parts[i] ?? '';
        }
        this.schedulingOptions.set(int(cell(parts, p.proj_id!)), record);
        return;
      }
      case 'CALENDAR': {
        const hours = Number(cell(parts, p.day_hr_cnt!));
        const dayMinutes = Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 480;
        const name = cell(parts, p.clndr_name!);
        const calendar = parseCalendar(
          int(cell(parts, p.clndr_id!)),
          name,
          dayMinutes,
          cell(parts, p.clndr_data!),
        );
        if (!calendar.parsed) this.warn('calendar-fallback', name);
        this.calendars.push(calendar);
        return;
      }
      case 'PROJWBS': {
        if (!this.isSelected(int(cell(parts, p.proj_id!)))) return;
        this.wbsId.push(int(cell(parts, p.wbs_id!)));
        this.wbsParentId.push(int(cell(parts, p.parent_wbs_id!)));
        this.wbsCode.push(this.strings.add(cell(parts, p.wbs_short_name!)));
        this.wbsName.push(this.strings.add(cell(parts, p.wbs_name!)));
        this.wbsOrder.push(int(cell(parts, p.seq_num!)));
        return;
      }
      case 'TASK':
        this.taskRow(parts);
        return;
      case 'TASKPRED': {
        this.relSucc.push(int(cell(parts, p.task_id!)));
        this.relPred.push(int(cell(parts, p.pred_task_id!)));
        const typeText = cell(parts, p.pred_type!);
        const type = REL_TYPE_CODES[typeText] ?? RelType.Unknown;
        if (type === RelType.Unknown) this.warn('unknown-relationship-type', typeText);
        this.relType.push(type);
        const lag = parseHoursAsMinutes(cell(parts, p.lag_hr_cnt!));
        this.relLag.push(lag === NONE ? 0 : lag);
        return;
      }
    }
  }

  private taskRow(parts: string[]): void {
    const p = this.p;
    const id = int(cell(parts, p.task_id!));
    if (!this.isSelected(int(cell(parts, p.proj_id!)))) {
      this.otherProjectTasks.add(id);
      return;
    }
    const code = cell(parts, p.task_code!);
    if (this.seenCodes.has(code)) this.warn('duplicate-task-code', code);
    else this.seenCodes.add(code);

    this.taskId.push(id);
    this.taskWbsId.push(int(cell(parts, p.wbs_id!)));
    this.taskCalendarId.push(int(cell(parts, p.clndr_id!)));
    this.taskCode.push(this.strings.add(code));
    this.taskName.push(this.strings.add(cell(parts, p.task_name!)));

    const typeText = cell(parts, p.task_type!);
    const type = TASK_TYPE_CODES[typeText] ?? TaskType.Unknown;
    if (type === TaskType.Unknown) this.warn('unknown-task-type', `${code}: ${typeText}`);
    this.type.push(type);

    const statusText = cell(parts, p.status_code!);
    const status = STATUS_CODES[statusText] ?? Status.Unknown;
    if (status === Status.Unknown) this.warn('unknown-status', `${code}: ${statusText}`);
    this.status.push(status);

    this.earlyStart.push(this.date(cell(parts, p.early_start_date!), code));
    this.earlyFinish.push(this.date(cell(parts, p.early_end_date!), code));
    this.lateStart.push(this.date(cell(parts, p.late_start_date!), code));
    this.lateFinish.push(this.date(cell(parts, p.late_end_date!), code));
    this.actualStart.push(this.date(cell(parts, p.act_start_date!), code));
    this.actualFinish.push(this.date(cell(parts, p.act_end_date!), code));
    this.targetStart.push(this.date(cell(parts, p.target_start_date!), code));
    this.targetFinish.push(this.date(cell(parts, p.target_end_date!), code));
    this.originalDuration.push(parseHoursAsMinutes(cell(parts, p.target_drtn_hr_cnt!)));
    this.remainingDuration.push(parseHoursAsMinutes(cell(parts, p.remain_drtn_hr_cnt!)));
    this.totalFloat.push(parseHoursAsMinutes(cell(parts, p.total_float_hr_cnt!)));
    this.freeFloat.push(parseHoursAsMinutes(cell(parts, p.free_float_hr_cnt!)));

    const constraintText = cell(parts, p.cstr_type!);
    let constraint: number = ConstraintType.None;
    if (constraintText !== '') {
      constraint = CONSTRAINT_CODES[constraintText] ?? ConstraintType.Unknown;
      if (constraint === ConstraintType.Unknown) {
        this.warn('unknown-constraint-type', `${code}: ${constraintText}`);
      }
    }
    this.constraintType.push(constraint);
    this.constraintDate.push(this.date(cell(parts, p.cstr_date!), code));
  }

  private build(): ScheduleData {
    const n = this.taskId.length;

    if (this.projects.length > 1) {
      this.warn('multiple-projects', `${this.projects.length} projects in the file`);
    }
    const project = this.projects.find((candidate) => candidate.id === this.selectedProject);

    // Calendars
    const calendarIndexById = new Map<number, number>();
    this.calendars.forEach((calendar, index) => calendarIndexById.set(calendar.id, index));
    const defaultCalendarId = this.projectDefaultCalendar.get(this.selectedProject) ?? -1;

    // WBS
    const wbsCount = this.wbsId.length;
    const wbsIndexById = new Map<number, number>();
    for (let w = 0; w < wbsCount; w++) wbsIndexById.set(this.wbsId.at(w), w);
    const wbsParent = new Int32Array(wbsCount);
    for (let w = 0; w < wbsCount; w++) {
      wbsParent[w] = wbsIndexById.get(this.wbsParentId.at(w)) ?? -1;
    }

    // Activities
    const taskCode = this.taskCode.finish();
    const wbsIndex = new Int32Array(n);
    const calendarIndex = new Int16Array(n);
    const indexByTaskId = new Map<number, number>();
    const strings = this.strings.finish();
    const decoder = new TextDecoder();
    const codeOf = (i: number) =>
      decoder.decode(
        strings.bytes.subarray(strings.offsets[taskCode[i]!]!, strings.offsets[taskCode[i]! + 1]!),
      );
    for (let i = 0; i < n; i++) {
      indexByTaskId.set(this.taskId.at(i), i);
      const wbs = wbsIndexById.get(this.taskWbsId.at(i)) ?? -1;
      if (wbs < 0) this.warn('missing-wbs', codeOf(i));
      wbsIndex[i] = wbs;
      const calendar = calendarIndexById.get(this.taskCalendarId.at(i)) ?? -1;
      if (calendar < 0) this.warn('missing-calendar', codeOf(i));
      calendarIndex[i] = calendar;
    }

    // Relationships: keep those whose two ends are both in this project, then
    // lay them out twice (by predecessor and by successor) with a counting sort.
    const relCount = this.relSucc.length;
    const succIndex = new Int32Array(relCount);
    const predIndex = new Int32Array(relCount);
    const keep = new Uint8Array(relCount);
    const succOffsets = new Int32Array(n + 1);
    const predOffsets = new Int32Array(n + 1);
    let kept = 0;
    for (let r = 0; r < relCount; r++) {
      const succId = this.relSucc.at(r);
      const predId = this.relPred.at(r);
      const succ = indexByTaskId.get(succId);
      const pred = indexByTaskId.get(predId);
      if (succ === undefined || pred === undefined) {
        // A link with neither end in this project belongs to another project entirely.
        if (succ === undefined && pred === undefined) {
          if (!this.otherProjectTasks.has(succId) || !this.otherProjectTasks.has(predId)) {
            this.warn('relationship-missing-task', `task ids ${predId} -> ${succId}`);
          }
        } else if (this.otherProjectTasks.has(succ === undefined ? succId : predId)) {
          this.warn('relationship-external', codeOf((succ ?? pred)!));
        } else {
          this.warn('relationship-missing-task', codeOf((succ ?? pred)!));
        }
        continue;
      }
      if (succ === pred) {
        this.warn('relationship-self', codeOf(succ));
        continue;
      }
      keep[r] = 1;
      succIndex[r] = succ;
      predIndex[r] = pred;
      succOffsets[pred + 1]!++;
      predOffsets[succ + 1]!++;
      kept++;
    }
    for (let i = 0; i < n; i++) {
      succOffsets[i + 1]! += succOffsets[i]!;
      predOffsets[i + 1]! += predOffsets[i]!;
    }
    const succTargets = new Int32Array(kept);
    const succType = new Uint8Array(kept);
    const succLagMin = new Int32Array(kept);
    const predTargets = new Int32Array(kept);
    const predType = new Uint8Array(kept);
    const predLagMin = new Int32Array(kept);
    const succCursor = succOffsets.slice(0, n);
    const predCursor = predOffsets.slice(0, n);
    for (let r = 0; r < relCount; r++) {
      if (!keep[r]) continue;
      const succ = succIndex[r]!;
      const pred = predIndex[r]!;
      const type = this.relType.at(r);
      const lag = this.relLag.at(r);
      const s = succCursor[pred]!++;
      succTargets[s] = succ;
      succType[s] = type;
      succLagMin[s] = lag;
      const q = predCursor[succ]!++;
      predTargets[q] = pred;
      predType[q] = type;
      predLagMin[q] = lag;
    }

    return {
      n,
      taskCode,
      taskName: this.taskName.finish(),
      wbsIndex,
      calendarIndex,
      type: this.type.finish(),
      status: this.status.finish(),
      earlyStart: this.earlyStart.finish(),
      earlyFinish: this.earlyFinish.finish(),
      lateStart: this.lateStart.finish(),
      lateFinish: this.lateFinish.finish(),
      actualStart: this.actualStart.finish(),
      actualFinish: this.actualFinish.finish(),
      targetStart: this.targetStart.finish(),
      targetFinish: this.targetFinish.finish(),
      originalDurationMin: this.originalDuration.finish(),
      remainingDurationMin: this.remainingDuration.finish(),
      totalFloatMin: this.totalFloat.finish(),
      freeFloatMin: this.freeFloat.finish(),
      constraintType: this.constraintType.finish(),
      constraintDate: this.constraintDate.finish(),
      succOffsets,
      succTargets,
      succType,
      succLagMin,
      predOffsets,
      predTargets,
      predType,
      predLagMin,
      wbs: {
        n: wbsCount,
        parent: wbsParent,
        code: this.wbsCode.finish(),
        name: this.wbsName.finish(),
        order: this.wbsOrder.finish(),
      },
      strings,
      calendars: {
        n: this.calendars.length,
        calendars: this.calendars,
        defaultIndex: calendarIndexById.get(defaultCalendarId) ?? -1,
      },
      meta: {
        formatVersion: FORMAT_VERSION,
        sourceHash: '',
        epoch: EPOCH,
        projectId: this.selectedProject,
        projectName: project?.name ?? '',
        dataDate: project?.dataDate ?? NONE,
        projects: this.projects,
        schedulingOptions: this.schedulingOptions.get(this.selectedProject) ?? {},
        relationshipCount: kept,
        incomplete: !this.ended,
        warnings: [...this.warnings.values()],
      },
    };
  }
}

/** The fields we read from each table. Tables not listed here are skipped without splitting their rows. */
const FIELDS: Record<string, string[]> = {
  PROJECT: ['proj_id', 'proj_short_name', 'last_recalc_date', 'plan_start_date', 'clndr_id'],
  SCHEDOPTIONS: ['proj_id'],
  CALENDAR: ['clndr_id', 'clndr_name', 'day_hr_cnt', 'clndr_data'],
  PROJWBS: ['wbs_id', 'proj_id', 'parent_wbs_id', 'wbs_short_name', 'wbs_name', 'seq_num'],
  TASK: [
    'task_id',
    'proj_id',
    'wbs_id',
    'clndr_id',
    'task_code',
    'task_name',
    'task_type',
    'status_code',
    'target_drtn_hr_cnt',
    'remain_drtn_hr_cnt',
    'early_start_date',
    'early_end_date',
    'late_start_date',
    'late_end_date',
    'act_start_date',
    'act_end_date',
    'target_start_date',
    'target_end_date',
    'total_float_hr_cnt',
    'free_float_hr_cnt',
    'cstr_type',
    'cstr_date',
  ],
  TASKPRED: ['task_id', 'pred_task_id', 'pred_type', 'lag_hr_cnt'],
};

/** Fields without which a table cannot be used. Their absence is reported once per table. */
const REQUIRED: Record<string, string[]> = {
  PROJECT: ['proj_id'],
  CALENDAR: ['clndr_id'],
  PROJWBS: ['wbs_id'],
  TASK: ['task_id', 'task_code'],
  TASKPRED: ['task_id', 'pred_task_id', 'pred_type'],
};

const TABLES = new Set(Object.keys(FIELDS));

/** Parses a whole XER held in memory. For tests and small files; real imports stream with XerParser. */
export function parseXerText(text: string, options?: ParseOptions): ScheduleData {
  const parser = new XerParser(options);
  parser.push(text);
  return parser.finish();
}

/** Every ArrayBuffer in a schedule, each listed once, for a zero-copy postMessage. */
export function getTransferList(data: ScheduleData): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  const visit = (value: unknown): void => {
    if (ArrayBuffer.isView(value)) {
      buffers.add(value.buffer as ArrayBuffer);
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(visit);
    }
  };
  visit(data);
  return [...buffers];
}
