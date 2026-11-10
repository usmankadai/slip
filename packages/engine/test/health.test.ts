import { describe, expect, it } from 'vitest';
import { parseXerText, stringAt, type ScheduleData } from '@slip/xer';
import { buildXer, row, task } from '../../xer/test/fixture.ts';
import { prepareClocks, runHealth, type HealthCheck } from '../src/index.ts';

// The fixture's data date is Sunday 1 February 2026 at 08:00, on a Monday to Friday calendar.
const ids = new Map<string, number>();
let nextId = 1;
const activity = (code: string, hours: number, extra: Record<string, string | number> = {}) => {
  ids.set(code, 2000 + nextId++);
  return task({
    task_id: ids.get(code)!,
    proj_id: 1,
    wbs_id: 12,
    clndr_id: 5,
    task_code: code,
    task_name: code,
    task_type: 'TT_Task',
    status_code: 'TK_NotStart',
    target_drtn_hr_cnt: hours,
    remain_drtn_hr_cnt: hours,
    ...extra,
  });
};
const link = (pred: string, succ: string, type = 'PR_FS', lagHours = 0) =>
  row('%R', nextId++, ids.get(succ)!, ids.get(pred)!, 1, 1, type, lagHours);

const tasks = [
  activity('DONE', 40, {
    status_code: 'TK_Complete',
    act_start_date: '2026-01-12 08:00',
    act_end_date: '2026-01-16 17:00',
    target_end_date: '2026-01-16 17:00',
  }),
  activity('LATE', 40, {
    status_code: 'TK_Active',
    act_start_date: '2026-01-19 08:00',
    target_end_date: '2026-01-23 17:00',
    remain_drtn_hr_cnt: 16,
  }),
  activity('MAIN', 80, {
    early_start_date: '2026-02-04 08:00',
    early_end_date: '2026-02-17 17:00',
    total_float_hr_cnt: 0,
  }),
  activity('LOOSE', 400, { total_float_hr_cnt: 400 }),
  activity('HARD', 16, {
    cstr_type: 'CS_MSO',
    cstr_date: '2026-02-18 08:00',
    total_float_hr_cnt: -8,
  }),
  activity('PAST', 16, {
    early_start_date: '2026-01-20 08:00',
    early_end_date: '2026-02-20 17:00',
  }),
  activity('FUTURE', 40, {
    status_code: 'TK_Complete',
    act_start_date: '2026-01-26 08:00',
    act_end_date: '2026-02-10 17:00',
    target_end_date: '2026-01-30 17:00',
  }),
  activity('END', 0, {
    task_type: 'TT_FinMile',
    early_end_date: '2026-03-02 17:00',
    total_float_hr_cnt: 0,
  }),
  activity('LOE', 4000, { task_type: 'TT_LOE', total_float_hr_cnt: 9000 }),
];
const rels = [
  link('DONE', 'LATE'),
  link('LATE', 'MAIN'),
  link('MAIN', 'HARD', 'PR_FS', -8),
  link('MAIN', 'PAST', 'PR_SS', 16),
  link('MAIN', 'END'),
  link('HARD', 'END'),
  link('PAST', 'END'),
  link('LOE', 'END'),
];
const data = parseXerText(buildXer({ tasks, rels }));
const fileDates = (d: ScheduleData) => ({
  earlyStart: d.earlyStart,
  earlyFinish: d.earlyFinish,
  totalFloat: d.totalFloatMin,
});
const checks = runHealth(data, prepareClocks(data), fileDates(data));
const check = (id: number): HealthCheck => checks.find((entry) => entry.id === id)!;
const codes = (id: number) =>
  Array.from(check(id).offenders, (i) => stringAt(data.strings, data.taskCode[i]!)).sort();

describe('DCMA checks', () => {
  it('returns the fourteen checks in order', () => {
    expect(checks.map((entry) => entry.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
  });

  it('1 missing logic: unfinished activities with no predecessor or no successor', () => {
    // Six unfinished activities; LOOSE has neither, END has no successor. The level of effort is left out.
    expect(check(1)).toMatchObject({
      count: 2,
      population: 6,
      pass: false,
      unit: 'percent',
      threshold: 5,
    });
    expect(check(1).value).toBeCloseTo(33.33, 1);
    expect(codes(1)).toEqual(['END', 'LOOSE']);
  });

  it('2 leads, 3 lags and 4 relationship types, over relationships into unfinished work', () => {
    // Seven relationships: the one from the level of effort is left out.
    expect(check(2)).toMatchObject({ count: 1, population: 7, value: 1, pass: false });
    expect(codes(2)).toEqual(['HARD']);
    expect(check(3)).toMatchObject({ count: 1, population: 7, pass: false });
    expect(check(3).value).toBeCloseTo(14.29, 1);
    expect(codes(3)).toEqual(['PAST']);
    expect(check(4)).toMatchObject({
      count: 1,
      population: 7,
      pass: false,
      limit: 'min',
      threshold: 90,
    });
    expect(check(4).value).toBeCloseTo(85.71, 1);
    expect(codes(4)).toEqual(['PAST']);
  });

  it('5 hard constraints, 6 high float, 7 negative float, 8 high duration', () => {
    expect(check(5)).toMatchObject({ count: 1, population: 6, pass: false });
    expect(codes(5)).toEqual(['HARD']);
    expect(check(6)).toMatchObject({ count: 1, population: 6, pass: false });
    expect(codes(6)).toEqual(['LOOSE']);
    expect(check(7)).toMatchObject({ count: 1, value: 1, pass: false, threshold: 0 });
    expect(codes(7)).toEqual(['HARD']);
    // Milestones are left out of the duration check: five unfinished tasks.
    expect(check(8)).toMatchObject({ count: 1, population: 5, pass: false });
    expect(check(8).value).toBe(20);
    expect(codes(8)).toEqual(['LOOSE']);
  });

  it('9 invalid dates: an actual in the future and a forecast in the past', () => {
    expect(check(9)).toMatchObject({ count: 2, pass: false });
    expect(codes(9)).toEqual(['FUTURE', 'PAST']);
  });

  it('10 resources is reported as not assessed', () => {
    expect(check(10)).toMatchObject({ value: null, pass: null });
    expect(check(10).note).toMatch(/not read/);
  });

  it('11 missed tasks and 14 baseline execution index, over activities due by the data date', () => {
    // Due: DONE (on time), LATE (not finished), FUTURE (finished after its baseline).
    expect(check(11)).toMatchObject({ count: 2, population: 3, pass: false });
    expect(check(11).value).toBeCloseTo(66.67, 1);
    expect(codes(11)).toEqual(['FUTURE', 'LATE']);
    expect(check(14)).toMatchObject({ count: 2, population: 3, pass: false, unit: 'ratio' });
    expect(check(14).value).toBeCloseTo(0.667, 2);
  });

  it('12 critical path test is reported only', () => {
    expect(check(12)).toMatchObject({ count: 3, pass: null, threshold: null });
    expect(codes(12)).toEqual(['END', 'HARD', 'MAIN']);
  });

  it('13 critical path length index', () => {
    // 21 working days from the data date to 2 March, and one day of negative float: 20 / 21.
    expect(check(13).value).toBeCloseTo(20 / 21, 5);
    expect(check(13).pass).toBe(true);
  });

  it('passes a clean schedule', () => {
    nextId = 500;
    const clean = [
      activity('C1', 40, {
        total_float_hr_cnt: 0,
        early_start_date: '2026-02-02 08:00',
        early_end_date: '2026-02-06 17:00',
      }),
      ...Array.from({ length: 30 }, (_, k) =>
        activity(`C${k + 2}`, 40, {
          total_float_hr_cnt: 0,
          early_start_date: '2026-02-09 08:00',
          early_end_date: '2026-02-13 17:00',
        }),
      ),
    ];
    const chain = Array.from({ length: 30 }, (_, k) => link(`C${k + 1}`, `C${k + 2}`));
    const tidy = parseXerText(buildXer({ tasks: clean, rels: chain }));
    const result = runHealth(tidy, prepareClocks(tidy), fileDates(tidy));
    // Only the two ends of the chain lack a predecessor or successor: 2 of 31 is over 5%.
    expect(result.find((entry) => entry.id === 1)).toMatchObject({ count: 2, pass: false });
    for (const id of [2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(result.find((entry) => entry.id === id)!.pass, `check ${id}`).toBe(true);
    }
    expect(result.find((entry) => entry.id === 11)).toMatchObject({ value: null, pass: null });
    expect(result.find((entry) => entry.id === 14)).toMatchObject({ value: null, pass: null });
  });

  it('does not divide by zero on an empty schedule', () => {
    const empty = parseXerText(buildXer({ tasks: [], rels: [] }));
    const result = runHealth(empty, prepareClocks(empty), fileDates(empty));
    expect(result).toHaveLength(14);
    for (const entry of result) {
      expect(Number.isNaN(entry.value)).toBe(false);
      expect(entry.offenders.length).toBe(0);
    }
    expect(result[0]).toMatchObject({ value: null, pass: null });
  });
});
