/**
 * Runs the agent's tools against a real engine session loaded with a
 * generated pair, and checks what they tell the model against expected.json.
 */
import { describe, expect, it } from 'vitest';
import { TOOL_LIMITS, splitCitations } from '@slip/agent';
import { runTool, type ToolEngine, type ToolOutcome } from '@slip/agent/run';
import { EngineSession, type EngineRequest } from '@slip/engine';
import { parseXerText } from '@slip/xer';
import { generatePair, xerText } from '../src/index.ts';

const pair = generatePair({ activities: 1000, seed: 42, sector: 'rail' });
const textA = xerText(pair.update01);
const textB = xerText(pair.update02);
const { expected } = pair;

function engineWith(...slots: ('a' | 'b')[]): {
  engine: ToolEngine;
  session: EngineSession;
  requests: EngineRequest[];
} {
  const session = new EngineSession();
  if (slots.includes('a')) session.handle({ type: 'load', slot: 'a', data: parseXerText(textA) });
  if (slots.includes('b')) session.handle({ type: 'load', slot: 'b', data: parseXerText(textB) });
  const requests: EngineRequest[] = [];
  const engine = {
    request: async (request: EngineRequest) => {
      requests.push(request);
      return session.handle(request);
    },
  } as ToolEngine;
  return { engine, session, requests };
}
const { engine, session } = engineWith('a', 'b');
const read = (outcome: ToolOutcome) => JSON.parse(outcome.content);
const bytes = (outcome: ToolOutcome) => new TextEncoder().encode(outcome.content).length;
const driver = expected.drivers[0]!;

describe('search_activities', () => {
  it('finds the activities that slipped most, largest first', async () => {
    const outcome = await runTool(engine, 'search_activities', {
      changed_only: true,
      sort_by: 'finish_slip',
      limit: 5,
    });
    const result = read(outcome);
    expect(outcome.isError).toBe(false);
    expect(result.rows).toHaveLength(5);
    expect(result.total).toBeGreaterThan(5);
    expect(result.truncated).toBe(true);
    const slips = result.rows.map((row: { finish_slip_days: number }) => row.finish_slip_days);
    expect(slips).toEqual([...slips].sort((x, y) => y - x));
    expect(slips[0]).toBeGreaterThanOrEqual(expected.milestone.slipWorkingDays);
    expect(outcome.codes).toEqual(result.rows.map((row: { code: string }) => row.code));
  });

  it('finds by text, by kind of change and by status', async () => {
    const byText = read(await runTool(engine, 'search_activities', { query: 'ms-complete' }));
    expect(byText.rows).toMatchObject([
      {
        code: 'MS-COMPLETE',
        status: 'not_started',
        finish: expected.milestone.finish02,
        finish_slip_days: expected.milestone.slipWorkingDays,
      },
    ]);
    expect(byText.rows[0].changes).toContain('finish_moved');

    const added = read(await runTool(engine, 'search_activities', { change_kinds: ['added'] }));
    expect(added.rows.map((row: { code: string }) => row.code).sort()).toEqual(
      [...expected.changes.added].sort(),
    );
    expect(added.rows[0].finish_slip_days).toBeNull();

    const done = read(
      await runTool(engine, 'search_activities', { status: ['complete'], limit: 3 }),
    );
    expect(done.rows.every((row: { status: string }) => row.status === 'complete')).toBe(true);
    expect(
      read(await runTool(engine, 'search_activities', { query: 'no such activity anywhere' })),
    ).toMatchObject({ total: 0, shown: 0, rows: [] });
  });

  it('puts the least float first when asked for the critical activities', async () => {
    const result = read(
      await runTool(engine, 'search_activities', {
        critical_only: true,
        sort_by: 'total_float',
        limit: 10,
      }),
    );
    const floats = result.rows.map((row: { total_float_days: number }) => row.total_float_days);
    expect(floats).toEqual([...floats].sort((x, y) => x - y));
    expect(floats.every((float: number) => float <= 0)).toBe(true);
  });

  it('never sends more than the limits allow', async () => {
    const all = await runTool(engine, 'search_activities', { limit: 50 });
    expect(read(all).rows.length).toBeLessThanOrEqual(TOOL_LIMITS.rows);
    expect(bytes(all)).toBeLessThanOrEqual(TOOL_LIMITS.bytes);
    expect(read(all).activities_in_update).toBe(expected.update02.activities);
  });
});

describe('get_activity', () => {
  it('describes an activity in both updates with what changed', async () => {
    const outcome = await runTool(engine, 'get_activity', { task_code: driver.code });
    const result = read(outcome);
    expect(result).toMatchObject({
      code: driver.code,
      in_previous_update: true,
      in_current_update: true,
      duration_change_days: driver.growthWorkingDays,
    });
    expect(result.changes).toContain('duration_changed');
    expect(result.current.original_duration_days - result.previous.original_duration_days).toBe(
      driver.growthWorkingDays,
    );
    expect(result.current.predecessors.length).toBeGreaterThan(0);
    expect(result.current.predecessors[0]).toHaveProperty('task_code');
    expect(result.previous).not.toHaveProperty('predecessors');
    expect(outcome.codes).toContain(driver.code);
    expect(outcome.codes).toContain(result.current.predecessors[0].task_code);
    expect(bytes(outcome)).toBeLessThanOrEqual(TOOL_LIMITS.bytes);
  });

  it('handles added, removed and unknown activities', async () => {
    const added = read(
      await runTool(engine, 'get_activity', { task_code: expected.changes.added[0]! }),
    );
    expect(added).toMatchObject({
      in_previous_update: false,
      in_current_update: true,
      previous: null,
      finish_slip_days: null,
    });
    expect(added.changes).toEqual(['added']);

    const removed = read(
      await runTool(engine, 'get_activity', { task_code: expected.changes.removed[0]! }),
    );
    expect(removed).toMatchObject({
      in_previous_update: true,
      in_current_update: false,
      current: null,
    });
    expect(removed.previous).toHaveProperty('predecessors');

    const missing = await runTool(engine, 'get_activity', { task_code: 'NO-SUCH-CODE' });
    expect(missing.isError).toBe(true);
    expect(missing.codes).toEqual([]);
  });

  it('stays within the size limit for an activity with many relationships', async () => {
    const outcome = await runTool(engine, 'get_activity', { task_code: 'MS-START' });
    expect(bytes(outcome)).toBeLessThanOrEqual(TOOL_LIMITS.bytes);
    const result = read(outcome);
    expect(result.current.successor_count).toBeGreaterThanOrEqual(result.current.successors.length);
  });
});

describe('trace_slip', () => {
  it('names the scripted drivers first, with the days each added', async () => {
    const outcome = await runTool(engine, 'trace_slip', { task_code: expected.milestone.code });
    const result = read(outcome);
    expect(result).toMatchObject({
      task_code: 'MS-COMPLETE',
      slip_working_days: expected.milestone.slipWorkingDays,
      path_cut_short: false,
    });
    const top = result.contributors.slice(0, expected.drivers.length);
    expect(top.map((entry: { code: string }) => entry.code).sort()).toEqual(
      expected.drivers.map((entry) => entry.code).sort(),
    );
    expect(top.every((entry: { cause: string }) => entry.cause === 'duration')).toBe(true);
    expect(top.find((entry: { code: string }) => entry.code === driver.code).working_days).toBe(
      driver.growthWorkingDays,
    );
    for (const entry of expected.drivers) expect(outcome.codes).toContain(entry.code);
    expect(Object.keys(result.path_ends_at).length).toBeGreaterThan(0);
    expect(bytes(outcome)).toBeLessThanOrEqual(TOOL_LIMITS.bytes);
  });

  it('says why it cannot trace an unknown activity, or without the previous update', async () => {
    expect((await runTool(engine, 'trace_slip', { task_code: 'NO-SUCH-CODE' })).isError).toBe(true);
    const alone = engineWith('b');
    const outcome = await runTool(alone.engine, 'trace_slip', { task_code: 'MS-COMPLETE' });
    expect(outcome.isError).toBe(true);
    expect(read(outcome).error).toMatch(/not loaded/);
  });
});

describe('health_summary and diff_summary', () => {
  it('reports the fourteen checks for either update', async () => {
    const current = read(await runTool(engine, 'health_summary', { update: 'current' }));
    expect(current.checks.map((check: { id: number }) => check.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
    expect(current.checks[1]).toMatchObject({
      name: 'Leads',
      passes: false,
      passes_when: 'value at or below threshold',
    });
    expect(current.checks[9]).toMatchObject({ value: null, passes: null });
    const previous = read(await runTool(engine, 'health_summary', { update: 'previous' }));
    expect(previous.update).toBe('previous');
    expect(JSON.stringify(current)).not.toContain('offenders');
  });

  it('summarises the comparison with the counts the generator recorded and the milestones that moved', async () => {
    const outcome = await runTool(engine, 'diff_summary', {});
    const result = read(outcome);
    expect(result.by_kind_of_change).toMatchObject({
      added: expected.changes.added.length,
      removed: expected.changes.removed.length,
      duration_changed: expected.changes.durationChanged.length,
    });
    expect(result.previous_update).toEqual({
      activities: expected.update01.activities,
      data_date: expected.update01.dataDate,
    });
    expect(result.current_update.data_date).toBe(expected.update02.dataDate);
    const slips = result.milestones_moved.map(
      (entry: { slip_working_days: number }) => entry.slip_working_days,
    );
    expect(slips).toEqual([...slips].sort((x, y) => y - x));
    expect(
      result.milestones_moved.find((entry: { code: string }) => entry.code === 'MS-COMPLETE'),
    ).toMatchObject({
      previous_finish: expected.milestone.finish01,
      current_finish: expected.milestone.finish02,
      slip_working_days: expected.milestone.slipWorkingDays,
    });
    expect(outcome.codes).toContain('MS-COMPLETE');
    expect((await runTool(engineWith('b').engine, 'diff_summary', {})).isError).toBe(true);
  });
});

describe('propose_edit', () => {
  const snapshot = () =>
    JSON.stringify(
      session.handle({
        type: 'rows',
        slot: 'b',
        range: [0, 2000],
        columns: ['start', 'finish', 'originalDuration', 'constraintType', 'constraintDate'],
      }),
      (_, value) => (ArrayBuffer.isView(value) ? Array.from(value as Int32Array) : value),
    );

  it('reports the effect of a duration change without changing the schedule', async () => {
    session.handle({ type: 'cpm', slot: 'b' });
    const before = snapshot();
    const current = read(await runTool(engine, 'get_activity', { task_code: driver.code })).current
      .original_duration_days;
    const outcome = await runTool(engine, 'propose_edit', {
      task_code: driver.code,
      change: 'set_original_duration',
      working_days: current - 5,
      reason: `Recover time on #${driver.code}.`,
    });
    const result = read(outcome);
    expect(result).toMatchObject({
      proposed: true,
      applied: false,
      task_code: driver.code,
      from: current,
      to: current - 5,
    });
    const completion = result.effect.milestones_that_move.find(
      (move: { code: string }) => move.code === 'MS-COMPLETE',
    );
    expect(completion.finish_before).toBe(expected.milestone.finish02);
    // Five working days off an activity that drives completion brings completion in by five working days.
    expect(completion.change_working_days).toBe(-5);
    expect(completion).not.toHaveProperty('change_calendar_days');
    expect(result.effect.activities_whose_dates_move).toBeGreaterThan(0);
    expect(outcome.proposal).toMatchObject({
      taskCode: driver.code,
      field: 'originalDuration',
      reason: `Recover time on #${driver.code}.`,
    });
    expect(outcome.proposal!.to).toBeLessThan(outcome.proposal!.from);
    expect(snapshot()).toBe(before);
    expect(session.handle({ type: 'edits' })).toEqual({ type: 'edits', edits: [] });
  });

  it('proposes a constraint as a type and a date together', async () => {
    const before = snapshot();
    const outcome = await runTool(engine, 'propose_edit', {
      task_code: driver.code,
      change: 'set_constraint',
      constraint_type: 'start_on_or_after',
      constraint_date: '2029-01-08 08:00',
      reason: 'Access is not available before this date.',
    });
    const result = read(outcome);
    expect(result).toMatchObject({
      from: 'none',
      to: 'start_on_or_after',
      constraint_date: '2029-01-08 08:00',
    });
    expect(result.effect.activities_whose_dates_move).toBeGreaterThan(0);
    expect(outcome.proposal).toMatchObject({
      field: 'constraintType',
      also: { field: 'constraintDate' },
    });
    expect(snapshot()).toBe(before);
  });

  it('refuses what the engine refuses, and says why', async () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [
        {
          task_code: 'NO-SUCH-CODE',
          change: 'set_original_duration',
          working_days: 3,
          reason: 'x',
        },
        /no activity with that code/,
      ],
      [
        { task_code: 'MS-START', change: 'set_original_duration', working_days: 3, reason: 'x' },
        /finished/,
      ],
      [
        { task_code: 'MS-COMPLETE', change: 'set_original_duration', working_days: 3, reason: 'x' },
        /milestone/,
      ],
      [
        { task_code: driver.code, change: 'set_remaining_duration', working_days: 3, reason: 'x' },
        /not started/,
      ],
      [
        {
          task_code: driver.code,
          change: 'set_constraint',
          constraint_type: 'start_on',
          constraint_date: '2029-02-31 08:00',
          reason: 'x',
        },
        /not a real date/,
      ],
      [
        { task_code: driver.code, change: 'set_original_duration', reason: 'x' },
        /needs working_days/,
      ],
    ];
    for (const [input, pattern] of cases) {
      const outcome = await runTool(engine, 'propose_edit', input);
      expect(outcome.isError, JSON.stringify(input)).toBe(true);
      expect(read(outcome).error).toMatch(pattern);
      expect(outcome.proposal).toBeUndefined();
    }
  });
});

describe('every tool', () => {
  it('refuses a call that does not fit, before touching the engine', async () => {
    const spy = engineWith('a', 'b');
    for (const [name, input] of [
      ['get_activity', { task_code: 'A', extra: true }],
      ['delete_schedule', {}],
      ['search_activities', { limit: 9999 }],
    ] as const) {
      expect((await runTool(spy.engine, name, input)).isError).toBe(true);
    }
    expect(spy.requests).toEqual([]);
  });

  it('lets engine faults through as faults, not as tool results', async () => {
    const broken = {
      request: async () => {
        throw new Error('worker crashed');
      },
    } as unknown as ToolEngine;
    await expect(runTool(broken, 'diff_summary', {})).rejects.toThrow('worker crashed');
  });

  it('returns codes that make its own citations verifiable, and nothing invented is', async () => {
    const outcome = await runTool(engine, 'trace_slip', { task_code: 'MS-COMPLETE' });
    const known = new Set(outcome.codes);
    const parts = splitCitations(
      `#MS-COMPLETE slipped because of #${driver.code} and #P99-A999-XXX-0000.`,
      known,
    );
    expect(parts.filter((part) => part.kind !== 'text').map((part) => part.kind)).toEqual([
      'verified',
      'verified',
      'unverified',
    ]);
  });
});
