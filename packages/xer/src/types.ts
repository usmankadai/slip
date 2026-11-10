/**
 * The columnar schedule (decision D1). One activity is one index `i` into
 * every column; nothing here is an object per activity.
 */
import type { CalendarTable } from './calendar.ts';
import type { StringColumn, StringTable } from './columns.ts';

export const TaskType = {
  Unknown: 0,
  Task: 1,
  Resource: 2,
  StartMilestone: 3,
  FinishMilestone: 4,
  LevelOfEffort: 5,
  WbsSummary: 6,
} as const;

export const Status = { Unknown: 0, NotStarted: 1, Active: 2, Complete: 3 } as const;

export const RelType = { Unknown: 0, FS: 1, SS: 2, FF: 3, SF: 4 } as const;

export const ConstraintType = {
  None: 0,
  StartOn: 1,
  StartOnOrAfter: 2,
  StartOnOrBefore: 3,
  FinishOn: 4,
  FinishOnOrAfter: 5,
  FinishOnOrBefore: 6,
  MandatoryStart: 7,
  MandatoryFinish: 8,
  AsLateAsPossible: 9,
  Unknown: 255,
} as const;

export const TASK_TYPE_CODES: Record<string, number> = {
  TT_Task: TaskType.Task,
  TT_Rsrc: TaskType.Resource,
  TT_Mile: TaskType.StartMilestone,
  TT_FinMile: TaskType.FinishMilestone,
  TT_LOE: TaskType.LevelOfEffort,
  TT_WBS: TaskType.WbsSummary,
};

export const STATUS_CODES: Record<string, number> = {
  TK_NotStart: Status.NotStarted,
  TK_Active: Status.Active,
  TK_Complete: Status.Complete,
};

export const REL_TYPE_CODES: Record<string, number> = {
  PR_FS: RelType.FS,
  PR_SS: RelType.SS,
  PR_FF: RelType.FF,
  PR_SF: RelType.SF,
};

export const CONSTRAINT_CODES: Record<string, number> = {
  CS_MSO: ConstraintType.StartOn,
  CS_MSOA: ConstraintType.StartOnOrAfter,
  CS_MSOB: ConstraintType.StartOnOrBefore,
  CS_MEO: ConstraintType.FinishOn,
  CS_MEOA: ConstraintType.FinishOnOrAfter,
  CS_MEOB: ConstraintType.FinishOnOrBefore,
  CS_MANDSTART: ConstraintType.MandatoryStart,
  CS_MANDFIN: ConstraintType.MandatoryFinish,
  CS_ALAP: ConstraintType.AsLateAsPossible,
};

/** One kind of problem found during import, with how often it happened and a few examples. */
export interface ImportWarning {
  kind: WarningKind;
  count: number;
  /** Up to 20 short examples (task codes, row numbers). Never whole rows. */
  examples: string[];
}

export type WarningKind =
  | 'truncated-file'
  | 'multiple-projects'
  | 'row-field-count'
  | 'continuation-line'
  | 'missing-field'
  | 'duplicate-task-code'
  | 'invalid-date'
  | 'unknown-task-type'
  | 'unknown-status'
  | 'unknown-relationship-type'
  | 'unknown-constraint-type'
  | 'missing-wbs'
  | 'missing-calendar'
  | 'calendar-fallback'
  | 'relationship-missing-task'
  | 'relationship-external'
  | 'relationship-self';

export interface ProjectInfo {
  id: number;
  name: string;
  /** Minutes since EPOCH, or NONE. */
  dataDate: number;
  planStart: number;
}

export interface ScheduleData {
  /** Activity count. */
  n: number;

  // Identity
  taskCode: StringColumn;
  taskName: StringColumn;
  /** Index into `wbs`, or -1 when the activity's WBS node is missing. */
  wbsIndex: Int32Array;
  /** Index into `calendars.calendars`, or -1 when missing (use the default calendar). */
  calendarIndex: Int16Array;
  type: Uint8Array;
  status: Uint8Array;

  // Time. Dates are minutes since EPOCH; durations and float are minutes. NONE means no value.
  earlyStart: Int32Array;
  earlyFinish: Int32Array;
  lateStart: Int32Array;
  lateFinish: Int32Array;
  actualStart: Int32Array;
  actualFinish: Int32Array;
  /** Planned ("target") dates, which P6 uses as the baseline when no other is assigned. */
  targetStart: Int32Array;
  targetFinish: Int32Array;
  originalDurationMin: Int32Array;
  remainingDurationMin: Int32Array;
  totalFloatMin: Int32Array;
  freeFloatMin: Int32Array;
  constraintType: Uint8Array;
  constraintDate: Int32Array;

  // Relationships, stored twice in compressed sparse row form.
  // Successors of activity i are succTargets[succOffsets[i] .. succOffsets[i + 1]).
  succOffsets: Int32Array;
  succTargets: Int32Array;
  succType: Uint8Array;
  succLagMin: Int32Array;
  predOffsets: Int32Array;
  predTargets: Int32Array;
  predType: Uint8Array;
  predLagMin: Int32Array;

  wbs: {
    n: number;
    /** Index of the parent node, or -1 for a root. */
    parent: Int32Array;
    code: StringColumn;
    name: StringColumn;
    order: Int32Array;
  };

  strings: StringTable;
  calendars: CalendarTable;

  meta: {
    formatVersion: number;
    /** SHA-256 of the source file as hex, or '' when the schedule did not come from a file. */
    sourceHash: string;
    epoch: string;
    projectId: number;
    projectName: string;
    dataDate: number;
    /** Every project found in the file. More than one means a choice was made. */
    projects: ProjectInfo[];
    /** The raw SCHEDOPTIONS row for the project, field name to value. Empty if absent. */
    schedulingOptions: Record<string, string>;
    relationshipCount: number;
    /** True when the file ended without its `%E` marker. */
    incomplete: boolean;
    warnings: ImportWarning[];
  };
}

/** Bump whenever the layout of ScheduleData changes. It invalidates cached schedules. */
export const FORMAT_VERSION = 1;
