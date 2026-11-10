/** A small hand-written XER used across the parser tests. Tabs are written as real tabs by `row`. */
export function row(...cells: (string | number)[]): string {
  return cells.join('\t');
}

const CALENDAR_DATA =
  '(0||CalendarData()( (0||DaysOfWeek()( (0||1()()) ' +
  [2, 3, 4, 5, 6]
    .map((d) => `(0||${d}()( (0||0(s|08:00|f|12:00)()) (0||1(s|13:00|f|17:00)()) ))`)
    .join(' ') +
  ' (0||7()()) )) (0||Exceptions()( (0||0(d|46016)()) (0||1(d|46017)( (0||0(s|08:00|f|12:00)()) )) )) ))';

const TASK_FIELDS = [
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
];

export function task(values: Record<string, string | number>): string {
  return row('%R', ...TASK_FIELDS.map((field) => values[field] ?? ''));
}

export const TASKS = [
  task({
    task_id: 101,
    proj_id: 1,
    wbs_id: 11,
    clndr_id: 5,
    task_code: 'MS-START',
    task_name: 'Contract start',
    task_type: 'TT_Mile',
    status_code: 'TK_Complete',
    target_drtn_hr_cnt: 0,
    remain_drtn_hr_cnt: 0,
    act_start_date: '2026-01-05 08:00',
    target_start_date: '2026-01-05 08:00',
  }),
  task({
    task_id: 102,
    proj_id: 1,
    wbs_id: 12,
    clndr_id: 5,
    task_code: 'A1000',
    task_name: 'Détail design – café',
    task_type: 'TT_Task',
    status_code: 'TK_Active',
    target_drtn_hr_cnt: 80,
    remain_drtn_hr_cnt: 40,
    early_start_date: '2026-01-12 08:00',
    early_end_date: '2026-01-16 17:00',
    late_start_date: '2026-01-19 08:00',
    late_end_date: '2026-01-23 17:00',
    act_start_date: '2026-01-05 08:00',
    target_start_date: '2026-01-05 08:00',
    target_end_date: '2026-01-16 17:00',
    total_float_hr_cnt: 40,
    free_float_hr_cnt: 0,
  }),
  task({
    task_id: 103,
    proj_id: 1,
    wbs_id: 12,
    clndr_id: 5,
    task_code: 'A1010',
    task_name: 'Procure steel',
    task_type: 'TT_Task',
    status_code: 'TK_NotStart',
    target_drtn_hr_cnt: 120,
    remain_drtn_hr_cnt: 120,
    early_start_date: '2026-01-19 08:00',
    early_end_date: '2026-02-06 17:00',
    late_start_date: '2026-01-12 08:00',
    late_end_date: '2026-01-30 17:00',
    target_start_date: '2026-01-19 08:00',
    target_end_date: '2026-02-06 17:00',
    total_float_hr_cnt: -40,
    free_float_hr_cnt: 0,
    cstr_type: 'CS_MEOB',
    cstr_date: '2026-01-30 17:00',
  }),
  task({
    task_id: 104,
    proj_id: 1,
    wbs_id: 11,
    clndr_id: 5,
    task_code: 'MS-END',
    task_name: 'Completion',
    task_type: 'TT_FinMile',
    status_code: 'TK_NotStart',
    target_drtn_hr_cnt: 0,
    remain_drtn_hr_cnt: 0,
    early_end_date: '2026-02-06 17:00',
    late_end_date: '2026-01-30 17:00',
    total_float_hr_cnt: -40,
    free_float_hr_cnt: 0,
  }),
];

export function buildXer(
  parts: { tasks?: string[]; rels?: string[]; end?: boolean; extra?: string[] } = {},
): string {
  const lines = [
    row(
      'ERMHDR',
      '20.12',
      '2026-02-01',
      'Project',
      'admin',
      'Admin',
      'dbxDatabaseNoName',
      'Project Management',
      'GBP',
    ),
    '%T\tCURRTYPE',
    row('%F', 'curr_id', 'curr_short_name'),
    row('%R', 1, 'GBP'),
    '%T\tPROJECT',
    row('%F', 'proj_id', 'proj_short_name', 'clndr_id', 'last_recalc_date', 'plan_start_date'),
    row('%R', 1, 'RAIL-01', 5, '2026-02-01 08:00', '2026-01-05 08:00'),
    '%T\tCALENDAR',
    row('%F', 'clndr_id', 'clndr_name', 'day_hr_cnt', 'clndr_data'),
    row('%R', 5, 'Standard 5 day', 8, CALENDAR_DATA),
    '%T\tSCHEDOPTIONS',
    row('%F', 'schedoptions_id', 'proj_id', 'sched_retained_logic'),
    row('%R', 9, 1, 'Y'),
    '%T\tPROJWBS',
    row('%F', 'wbs_id', 'proj_id', 'seq_num', 'wbs_short_name', 'wbs_name', 'parent_wbs_id'),
    row('%R', 10, 1, 0, 'RAIL-01', 'Rail upgrade', ''),
    row('%R', 11, 1, 10, 'MS', 'Milestones', 10),
    row('%R', 12, 1, 20, 'DES', 'Design', 10),
    '%T\tTASK',
    row('%F', ...TASK_FIELDS),
    ...(parts.tasks ?? TASKS),
    '%T\tTASKPRED',
    row(
      '%F',
      'task_pred_id',
      'task_id',
      'pred_task_id',
      'proj_id',
      'pred_proj_id',
      'pred_type',
      'lag_hr_cnt',
    ),
    ...(parts.rels ?? [
      row('%R', 1, 102, 101, 1, 1, 'PR_FS', 0),
      row('%R', 2, 103, 102, 1, 1, 'PR_SS', 16),
      row('%R', 3, 104, 103, 1, 1, 'PR_FF', -8),
      row('%R', 4, 104, 102, 1, 1, 'PR_FS', 0),
    ]),
    ...(parts.extra ?? []),
  ];
  if (parts.end !== false) lines.push('%E');
  return lines.join('\r\n') + '\r\n';
}
