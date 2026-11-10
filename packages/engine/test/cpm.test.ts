import { describe, expect, it } from 'vitest';
import { NONE, formatXerDate, parseXerText, stringAt, type ScheduleData } from '@slip/xer';
import { buildXer, row, task } from '../../xer/test/fixture.ts';
import { runCpm, type CpmResult } from '../src/index.ts';

// The fixture calendar works Monday to Friday, 08:00-12:00 and 13:00-17:00.
// Its data date is Sunday 1 February 2026, so work starts on Monday 2 February.

let nextId = 1;
const activity = (code: string, hours: number, extra: Record<string, string | number> = {}) =>
  task({
    task_id: code,
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
  }).replace(`%R\t${code}\t`, `%R\t${ids.get(code) ?? ids.set(code, 1000 + nextId++).get(code)}\t`);
const ids = new Map<string, number>();
const link = (pred: string, succ: string, type = 'PR_FS', lagHours = 0) =>
  row('%R', nextId++, ids.get(succ)!, ids.get(pred)!, 1, 1, type, lagHours);

function schedule(
  tasks: string[],
  rels: string[],
): { data: ScheduleData; cpm: CpmResult; at: (code: string) => Record<string, string | number> } {
  const data = parseXerText(buildXer({ tasks, rels }));
  const cpm = runCpm(data);
  const index = new Map<string, number>();
  for (let i = 0; i < data.n; i++) index.set(stringAt(data.strings, data.taskCode[i]!), i);
  const at = (code: string) => {
    const i = index.get(code)!;
    return {
      start: formatXerDate(cpm.earlyStart[i]!),
      finish: formatXerDate(cpm.earlyFinish[i]!),
      lateStart: formatXerDate(cpm.lateStart[i]!),
      lateFinish: formatXerDate(cpm.lateFinish[i]!),
      float: cpm.totalFloat[i]!,
      freeFloat: cpm.freeFloat[i]!,
    };
  };
  return { data, cpm, at };
}

describe('runCpm', () => {
  it('schedules a chain, an open end, and each relationship type', () => {
    const tasks = [
      activity('A', 40),
      activity('B', 24),
      activity('END', 0, { task_type: 'TT_FinMile' }),
      activity('OPEN', 8),
      activity('SS', 16),
      activity('FF', 8),
      activity('SF', 8),
    ];
    const { cpm, at } = schedule(tasks, [
      link('A', 'B'),
      link('B', 'END'),
      link('A', 'OPEN'),
      link('A', 'SS', 'PR_SS', 16),
      link('B', 'FF', 'PR_FF'),
      link('B', 'SF', 'PR_SF', 8),
    ]);
    expect(at('A')).toMatchObject({
      start: '2026-02-02 08:00',
      finish: '2026-02-06 17:00',
      float: 0,
    });
    // Finish to start over a weekend.
    expect(at('B')).toMatchObject({
      start: '2026-02-09 08:00',
      finish: '2026-02-11 17:00',
      float: 0,
    });
    expect(at('END')).toMatchObject({
      start: '2026-02-11 17:00',
      finish: '2026-02-11 17:00',
      float: 0,
    });
    expect(formatXerDate(cpm.projectFinish)).toBe('2026-02-11 17:00');
    // No successor: it can finish as late as the project, and all of that is free float.
    expect(at('OPEN')).toMatchObject({
      start: '2026-02-09 08:00',
      finish: '2026-02-09 17:00',
      lateFinish: '2026-02-11 17:00',
      float: 960,
      freeFloat: 960,
    });
    // Start to start with a two day lag.
    expect(at('SS')).toMatchObject({ start: '2026-02-04 08:00', finish: '2026-02-05 17:00' });
    // Finish to finish pulls the whole activity later.
    expect(at('FF')).toMatchObject({ start: '2026-02-11 08:00', finish: '2026-02-11 17:00' });
    // Start to finish: finishes a day after B starts.
    expect(at('SF')).toMatchObject({ start: '2026-02-09 08:00', finish: '2026-02-09 17:00' });
  });

  it('keeps actual dates for finished work and reschedules the rest from the data date', () => {
    const tasks = [
      activity('DONE', 40, {
        status_code: 'TK_Complete',
        remain_drtn_hr_cnt: 0,
        act_start_date: '2026-01-19 08:00',
        act_end_date: '2026-01-23 17:00',
      }),
      activity('BUSY', 40, {
        status_code: 'TK_Active',
        remain_drtn_hr_cnt: 16,
        act_start_date: '2026-01-26 08:00',
      }),
      activity('NEXT', 8),
    ];
    const { cpm, data, at } = schedule(tasks, [link('DONE', 'BUSY'), link('BUSY', 'NEXT')]);
    expect(at('DONE')).toMatchObject({
      start: '2026-01-19 08:00',
      finish: '2026-01-23 17:00',
      lateFinish: '',
    });
    expect(cpm.totalFloat[0]).toBe(NONE);
    // Two days of work remain from Monday 2 February; the start stays the actual start.
    expect(at('BUSY')).toMatchObject({
      start: '2026-01-26 08:00',
      finish: '2026-02-03 17:00',
      float: 0,
    });
    expect(at('NEXT')).toMatchObject({ start: '2026-02-04 08:00', finish: '2026-02-04 17:00' });
    expect(cpm.dataDate).toBe(data.meta.dataDate);
  });

  it('applies constraints in both passes and reports negative float', () => {
    const tasks = [
      activity('X', 8, { cstr_type: 'CS_MSOA', cstr_date: '2026-02-10 08:00' }),
      activity('Y', 8, { cstr_type: 'CS_MEOB', cstr_date: '2026-02-10 17:00' }),
    ];
    const { at } = schedule(tasks, [link('X', 'Y')]);
    expect(at('X')).toMatchObject({
      start: '2026-02-10 08:00',
      finish: '2026-02-10 17:00',
      lateFinish: '2026-02-09 17:00',
      float: -480,
    });
    expect(at('Y')).toMatchObject({
      start: '2026-02-11 08:00',
      finish: '2026-02-11 17:00',
      lateFinish: '2026-02-10 17:00',
      float: -480,
    });
  });

  it('counts a lead as working time before the predecessor finishes', () => {
    const { at } = schedule([activity('P', 40), activity('Q', 8)], [link('P', 'Q', 'PR_FS', -8)]);
    expect(at('Q')).toMatchObject({ start: '2026-02-06 08:00', finish: '2026-02-06 17:00' });
  });

  it('treats an unknown relationship type as finish to start', () => {
    const { at } = schedule([activity('P', 8), activity('Q', 8)], [link('P', 'Q', 'PR_NEW')]);
    expect(at('Q')).toMatchObject({ start: '2026-02-03 08:00' });
  });

  it('uses the project default calendar when an activity has none', () => {
    const { data, at } = schedule([activity('P', 16, { clndr_id: 404 })], []);
    expect(data.calendarIndex[0]).toBe(-1);
    expect(at('P')).toMatchObject({ start: '2026-02-02 08:00', finish: '2026-02-03 17:00' });
  });

  it('does not hang on a logic loop: it reports it and still gives every activity dates', () => {
    const tasks = [
      activity('L1', 8),
      activity('L2', 8),
      activity('L3', 8),
      activity('AFTER', 8),
      activity('FREE', 8),
    ];
    const { cpm, data, at } = schedule(tasks, [
      link('L1', 'L2'),
      link('L2', 'L3'),
      link('L3', 'L1'),
      link('L3', 'AFTER'),
    ]);
    expect(
      Array.from(cpm.loopActivities, (i) => stringAt(data.strings, data.taskCode[i]!)),
    ).toEqual(['L1']);
    expect(cpm.ignoredRelationships).toBe(1);
    for (let i = 0; i < data.n; i++) {
      expect(cpm.earlyStart[i]).not.toBe(NONE);
      expect(cpm.lateFinish[i]).not.toBe(NONE);
    }
    // With L3 -> L1 left out, the rest is an ordinary chain.
    expect(at('L1').start).toBe('2026-02-02 08:00');
    expect(at('L2').start).toBe('2026-02-03 08:00');
    expect(at('L3').start).toBe('2026-02-04 08:00');
    expect(at('AFTER').start).toBe('2026-02-05 08:00');
    expect(at('L1').float).toBe(0);
    expect(at('FREE').float).toBe(1440);
  });

  it('handles two separate loops and a schedule with nothing in it', () => {
    const tasks = ['A1', 'A2', 'B1', 'B2'].map((code) => activity(code, 8));
    const looped = schedule(tasks, [
      link('A1', 'A2'),
      link('A2', 'A1'),
      link('B1', 'B2'),
      link('B2', 'B1'),
    ]);
    expect(looped.cpm.loopActivities.length).toBe(2);
    expect(looped.cpm.ignoredRelationships).toBe(2);

    const empty = schedule([], []);
    expect(empty.cpm.earlyStart.length).toBe(0);
    expect(empty.cpm.projectFinish).toBe(empty.data.meta.dataDate);
  });
});
