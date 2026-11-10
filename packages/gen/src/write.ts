/**
 * Writes an update as XER text. Output goes to `sink` in chunks of about
 * 64KB, so a 1M-activity file is never held in memory as one string.
 */
import { NONE, Status, formatXerDate, type Calendar } from '@slip/xer';
import type { Update } from './pair.ts';

const TASK_TYPES = ['', 'TT_Task', 'TT_Rsrc', 'TT_Mile', 'TT_FinMile', 'TT_LOE', 'TT_WBS'];
const STATUSES = ['', 'TK_NotStart', 'TK_Active', 'TK_Complete'];
const REL_TYPES = ['', 'PR_FS', 'PR_SS', 'PR_FF', 'PR_SF'];
const CONSTRAINTS = [
  '',
  'CS_MSO',
  'CS_MSOA',
  'CS_MSOB',
  'CS_MEO',
  'CS_MEOA',
  'CS_MEOB',
  'CS_MANDSTART',
  'CS_MANDFIN',
  'CS_ALAP',
];

const PROJECT_ID = 1;
/** Day serial of 2000-01-01 in the numbering P6 uses for calendar exceptions. */
const SERIAL_OF_EPOCH = 36526;

function clock(minutes: number): string {
  const wrapped = minutes === 1440 ? 0 : minutes;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

function periodsText(periods: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < periods.length; i += 2) {
    parts.push(`(0||${i / 2}(s|${clock(periods[i]!)}|f|${clock(periods[i + 1]!)})())`);
  }
  return parts.join(' ');
}

/** A calendar in P6's `clndr_data` form. The reader in @slip/xer parses this back to the same calendar. */
export function calendarData(calendar: Calendar): string {
  const days = calendar.week
    .map((periods, day) => `(0||${day + 1}()(${periodsText(periods)}))`)
    .join(' ');
  const exceptions = Array.from(
    calendar.exceptionDays,
    (day, k) =>
      `(0||${k}(d|${day + SERIAL_OF_EPOCH})(${periodsText(calendar.exceptionPeriods[k]!)}))`,
  ).join(' ');
  return `(0||CalendarData()( (0||DaysOfWeek()(${days})) (0||Exceptions()(${exceptions})) ))`;
}

function hours(minutes: number): string {
  return minutes === NONE ? '' : String(minutes / 60);
}

export function writeXer(update: Update, sink: (chunk: string) => void): void {
  const { net, schedule, baseline, idBase } = update;
  let lines: string[] = [];
  let size = 0;
  const out = (...cells: (string | number)[]) => {
    const line = cells.join('\t');
    lines.push(line);
    size += line.length + 2;
    if (size >= 65536) {
      sink(lines.join('\r\n') + '\r\n');
      lines = [];
      size = 0;
    }
  };
  const date = formatXerDate;
  const wbsId = (index: number) => idBase + 50_000_000 + index;

  out(
    'ERMHDR',
    '20.12',
    date(schedule.dataDate).slice(0, 10),
    'Project',
    'slip',
    'Slip synthetic generator',
    'dbxDatabaseNoName',
    'Project Management',
    'GBP',
  );

  out('%T', 'PROJECT');
  out('%F', 'proj_id', 'proj_short_name', 'clndr_id', 'last_recalc_date', 'plan_start_date');
  out(
    '%R',
    PROJECT_ID,
    net.projectName,
    net.calendars[0]!.id,
    date(schedule.dataDate),
    date(net.projectStart),
  );

  out('%T', 'CALENDAR');
  out(
    '%F',
    'clndr_id',
    'default_flag',
    'clndr_name',
    'proj_id',
    'day_hr_cnt',
    'week_hr_cnt',
    'clndr_type',
    'clndr_data',
  );
  net.calendars.forEach((calendar, index) => {
    const week = calendar.week.reduce((total, periods) => {
      for (let i = 0; i < periods.length; i += 2) total += periods[i + 1]! - periods[i]!;
      return total;
    }, 0);
    out(
      '%R',
      calendar.id,
      index === 0 ? 'Y' : 'N',
      calendar.name,
      '',
      calendar.dayMinutes / 60,
      week / 60,
      'CA_Base',
      calendarData(calendar),
    );
  });

  out('%T', 'SCHEDOPTIONS');
  out(
    '%F',
    'schedoptions_id',
    'proj_id',
    'sched_retained_logic',
    'sched_progress_override',
    'sched_calendar_on_relationship_lag',
    'sched_float_type',
  );
  out('%R', idBase + 1, PROJECT_ID, 'Y', 'N', 'rcal_Predecessor', 'FT_FF');

  out('%T', 'PROJWBS');
  out(
    '%F',
    'wbs_id',
    'proj_id',
    'seq_num',
    'proj_node_flag',
    'wbs_short_name',
    'wbs_name',
    'parent_wbs_id',
  );
  for (let w = 0; w < net.wbsCode.length; w++) {
    const parent = net.wbsParent[w]!;
    out(
      '%R',
      wbsId(w),
      PROJECT_ID,
      w * 10,
      parent < 0 ? 'Y' : 'N',
      net.wbsCode[w]!,
      net.wbsName[w]!,
      parent < 0 ? '' : wbsId(parent),
    );
  }

  out('%T', 'TASK');
  out(
    '%F',
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
    'total_float_hr_cnt',
    'free_float_hr_cnt',
    'cstr_type',
    'cstr_date',
    'act_start_date',
    'act_end_date',
    'early_start_date',
    'early_end_date',
    'late_start_date',
    'late_end_date',
    'target_start_date',
    'target_end_date',
  );
  const n = net.code.length;
  for (let i = 0; i < n; i++) {
    if (net.removed[i]) continue;
    const complete = schedule.status[i] === Status.Complete;
    out(
      '%R',
      idBase + i,
      PROJECT_ID,
      wbsId(net.wbs[i]!),
      net.calendars[net.calendar[i]!]!.id,
      net.code[i]!,
      net.name[i]!,
      TASK_TYPES[net.type[i]!]!,
      STATUSES[schedule.status[i]!]!,
      hours(net.duration[i]!),
      hours(complete ? 0 : schedule.remaining[i]!),
      hours(schedule.totalFloat[i]!),
      hours(schedule.freeFloat[i]!),
      CONSTRAINTS[net.constraintType[i]!]!,
      date(net.constraintDate[i]!),
      date(schedule.actualStart[i]!),
      date(schedule.actualFinish[i]!),
      date(schedule.earlyStart[i]!),
      date(schedule.earlyFinish[i]!),
      date(schedule.lateStart[i]!),
      date(schedule.lateFinish[i]!),
      date(baseline.earlyStart[i]!),
      date(baseline.earlyFinish[i]!),
    );
  }

  out('%T', 'TASKPRED');
  out(
    '%F',
    'task_pred_id',
    'task_id',
    'pred_task_id',
    'proj_id',
    'pred_proj_id',
    'pred_type',
    'lag_hr_cnt',
  );
  for (let r = 0; r < net.relPred.length; r++) {
    const pred = net.relPred[r]!;
    const succ = net.relSucc[r]!;
    if (net.relRemoved[r] || net.removed[pred] || net.removed[succ]) continue;
    out(
      '%R',
      idBase + 100_000_000 + r,
      idBase + succ,
      idBase + pred,
      PROJECT_ID,
      PROJECT_ID,
      REL_TYPES[net.relType[r]!]!,
      hours(net.relLag[r]!),
    );
  }

  out('%E');
  if (lines.length > 0) sink(lines.join('\r\n') + '\r\n');
}

/** The whole file as one string. For tests and small schedules only. */
export function xerText(update: Update): string {
  const chunks: string[] = [];
  writeXer(update, (chunk) => chunks.push(chunk));
  return chunks.join('');
}
