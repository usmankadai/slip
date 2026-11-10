/**
 * Small descriptions of a schedule and of one activity, for callers that
 * need more than grid cells: the agent's tools and the activity drawer.
 */
import { NONE, stringAt, type ScheduleData } from '@slip/xer';
import type { DiffDates } from './diff.ts';

export interface ScheduleInfo {
  projectName: string;
  dataDate: number;
  activities: number;
  relationships: number;
  /** Working minutes in a day, per calendar index. The last entry is the fallback calendar. */
  calendarDayMinutes: number[];
  calendarNames: string[];
  defaultCalendar: number;
  /** Whether the dates shown are recalculated (after CPM or an edit) or as stored in the file. */
  recalculated: boolean;
  edits: number;
}

export interface LinkDetail {
  taskCode: string;
  name: string;
  /** A RelType value. */
  type: number;
  lagMinutes: number;
}

export interface ActivityDetail {
  /** Activity index in its update. */
  index: number;
  taskCode: string;
  name: string;
  wbs: string;
  type: number;
  status: number;
  calendar: number;
  /** Working minutes in a day on its calendar. */
  dayMinutes: number;
  start: number;
  finish: number;
  earlyStart: number;
  earlyFinish: number;
  actualStart: number;
  actualFinish: number;
  originalDuration: number;
  remainingDuration: number;
  totalFloat: number;
  constraintType: number;
  constraintDate: number;
  predecessors: LinkDetail[];
  successors: LinkDetail[];
  /** How many there are in all; the lists above are cut to the first 30. */
  predecessorCount: number;
  successorCount: number;
}

const MAX_LINKS = 30;

export function scheduleInfo(
  data: ScheduleData,
  dayMinutes: number[],
  recalculated: boolean,
  edits: number,
): ScheduleInfo {
  return {
    projectName: data.meta.projectName,
    dataDate: data.meta.dataDate,
    activities: data.n,
    relationships: data.meta.relationshipCount,
    calendarDayMinutes: dayMinutes,
    calendarNames: [...data.calendars.calendars.map((calendar) => calendar.name), 'Fallback 5 day'],
    defaultCalendar: data.calendars.defaultIndex,
    recalculated,
    edits,
  };
}

/** Finds an activity by its exact code. -1 if there is none. */
export function indexOfCode(data: ScheduleData, taskCode: string): number {
  for (let i = 0; i < data.n; i++) {
    if (stringAt(data.strings, data.taskCode[i]!) === taskCode) return i;
  }
  return -1;
}

export function describeActivity(
  data: ScheduleData,
  dates: DiffDates,
  dayMinutesOf: (i: number) => number,
  i: number,
): ActivityDetail {
  const text = (id: number) => stringAt(data.strings, id);
  const links = (
    offsets: Int32Array,
    targets: Int32Array,
    types: Uint8Array,
    lags: Int32Array,
  ): LinkDetail[] => {
    const out: LinkDetail[] = [];
    for (let k = offsets[i]!; k < offsets[i + 1]! && out.length < MAX_LINKS; k++) {
      const other = targets[k]!;
      out.push({
        taskCode: text(data.taskCode[other]!),
        name: text(data.taskName[other]!),
        type: types[k]!,
        lagMinutes: lags[k]!,
      });
    }
    return out;
  };
  const node = data.wbsIndex[i]!;
  return {
    index: i,
    taskCode: text(data.taskCode[i]!),
    name: text(data.taskName[i]!),
    wbs: node < 0 ? '' : text(data.wbs.name[node]!),
    type: data.type[i]!,
    status: data.status[i]!,
    calendar: data.calendarIndex[i]!,
    dayMinutes: dayMinutesOf(i),
    start: data.actualStart[i] !== NONE ? data.actualStart[i]! : dates.earlyStart[i]!,
    finish: data.actualFinish[i] !== NONE ? data.actualFinish[i]! : dates.earlyFinish[i]!,
    earlyStart: dates.earlyStart[i]!,
    earlyFinish: dates.earlyFinish[i]!,
    actualStart: data.actualStart[i]!,
    actualFinish: data.actualFinish[i]!,
    originalDuration: data.originalDurationMin[i]!,
    remainingDuration: data.remainingDurationMin[i]!,
    totalFloat: dates.totalFloat[i]!,
    constraintType: data.constraintType[i]!,
    constraintDate: data.constraintDate[i]!,
    predecessors: links(data.predOffsets, data.predTargets, data.predType, data.predLagMin),
    successors: links(data.succOffsets, data.succTargets, data.succType, data.succLagMin),
    predecessorCount: data.predOffsets[i + 1]! - data.predOffsets[i]!,
    successorCount: data.succOffsets[i + 1]! - data.succOffsets[i]!,
  };
}
