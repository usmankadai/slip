import { describe, expect, it } from 'vitest';
import {
  Change,
  EngineError,
  EngineSession,
  type EngineRequest,
  type EngineResult,
} from '@slip/engine';
import { ConstraintType, NONE, Status, TaskType, formatXerDate, parseXerText } from '@slip/xer';
import { generatePair, xerText } from '../src/index.ts';

const pair = generatePair({ activities: 1000, seed: 42, sector: 'rail' });
const textA = xerText(pair.update01);
const textB = xerText(pair.update02);
const { expected } = pair;
const reference = parseXerText(textB);

function loaded(): EngineSession {
  const session = new EngineSession();
  session.handle({ type: 'load', slot: 'a', data: parseXerText(textA) });
  session.handle({ type: 'load', slot: 'b', data: parseXerText(textB) });
  return session;
}
function ask<T extends EngineRequest['type']>(
  session: EngineSession,
  request: Extract<EngineRequest, { type: T }>,
) {
  return session.handle(request) as Extract<EngineResult, { type: T }>;
}
/** Every activity's finish, start, float and durations, to compare whole schedules. */
function snapshot(session: EngineSession) {
  const rows = ask(session, {
    type: 'rows',
    slot: 'b',
    range: [0, 2000],
    columns: [
      'start',
      'finish',
      'totalFloat',
      'originalDuration',
      'remainingDuration',
      'constraintType',
      'constraintDate',
    ],
  });
  return Object.fromEntries(
    Object.entries(rows.numbers).map(([name, values]) => [name, Array.from(values)]),
  );
}
function refuses(session: EngineSession, request: unknown, pattern: RegExp) {
  try {
    session.handle(request as EngineRequest);
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).code).toBe('bad-request');
    expect((error as EngineError).message).toMatch(pattern);
  }
}

// A scripted driver on the standard calendar, like the completion milestone, so days compare exactly.
const driver = expected.drivers.find((entry) => {
  for (let j = 0; j < reference.n; j++) {
    if (formatCode(j) === entry.code) return reference.calendarIndex[j] === 0;
  }
  return false;
})!;
function formatCode(j: number): string {
  const { bytes, offsets } = reference.strings;
  return new TextDecoder().decode(
    bytes.subarray(offsets[reference.taskCode[j]!]!, offsets[reference.taskCode[j]! + 1]!),
  );
}
const driverIndex = Array.from({ length: reference.n }, (_, j) => j).find(
  (j) => formatCode(j) === driver.code,
)!;
const driverDuration = reference.originalDurationMin[driverIndex]!;
const FIVE_DAYS = 5 * 480;

describe('edits', () => {
  it('previews an edit without changing anything', () => {
    const session = loaded();
    session.handle({ type: 'cpm', slot: 'b' });
    const before = snapshot(session);
    const preview = ask(session, {
      type: 'applyEdit',
      taskCode: driver.code,
      field: 'originalDuration',
      to: driverDuration + FIVE_DAYS,
      preview: true,
    });
    expect(preview.applied).toBe(false);
    expect(preview.editCount).toBe(0);
    expect(preview.edit).toMatchObject({
      taskCode: driver.code,
      field: 'originalDuration',
      from: driverDuration,
      to: driverDuration + FIVE_DAYS,
    });
    expect(preview.changed.length).toBeGreaterThan(0);
    expect(snapshot(session)).toEqual(before);
    expect(ask(session, { type: 'edits' }).edits).toEqual([]);
  });

  it('moves the completion milestone by exactly the days added to an activity that drives it', () => {
    const session = loaded();
    const result = ask(session, {
      type: 'applyEdit',
      taskCode: driver.code,
      field: 'originalDuration',
      to: driverDuration + FIVE_DAYS,
    });
    expect(result.applied).toBe(true);
    expect(result.editCount).toBe(1);
    const completion = result.milestones.find((move) => move.taskCode === expected.milestone.code)!;
    expect(formatXerDate(completion.finishBefore)).toBe(expected.milestone.finish02);
    expect(completion.workingDays).toBe(5);
    // Five working days later on a Monday to Friday calendar is seven calendar days, holidays aside.
    const days = (completion.finishAfter - completion.finishBefore) / 1440;
    expect(days).toBeGreaterThanOrEqual(7);
    expect(days).toBeLessThanOrEqual(10);
    expect(result.projectFinishAfter).toBeGreaterThan(result.projectFinishBefore);
    expect(Array.from(result.changed)).toContain(driverIndex);
    // The biggest move comes first.
    const sizes = result.milestones.map((move) => Math.abs(move.finishAfter - move.finishBefore));
    expect(sizes).toEqual([...sizes].sort((x, y) => y - x));
  });

  it('gives the same answer for a preview as for the edit itself', () => {
    const request = {
      type: 'applyEdit',
      taskCode: driver.code,
      field: 'originalDuration',
      to: driverDuration + FIVE_DAYS,
    } as const;
    const preview = ask(loaded(), { ...request, preview: true });
    const applied = ask(loaded(), request);
    expect(Array.from(preview.changed)).toEqual(Array.from(applied.changed));
    expect(preview.milestones).toEqual(applied.milestones);
    expect(preview.projectFinishAfter).toBe(applied.projectFinishAfter);
  });

  it('shows the edited value and its consequences in the grid and the diff', () => {
    const session = loaded();
    const before = ask(session, { type: 'diff' });
    ask(session, {
      type: 'applyEdit',
      taskCode: driver.code,
      field: 'originalDuration',
      to: driverDuration + FIVE_DAYS,
    });
    const row = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 5],
      columns: ['originalDuration', 'durationDelta', 'flags'],
      filter: { text: driver.code },
    });
    expect(row.numbers.originalDuration![0]).toBe(driverDuration + FIVE_DAYS);
    expect(row.numbers.durationDelta![0]).toBe(driver.growthMinutes + FIVE_DAYS);
    expect(row.numbers.flags![0]! & Change.DurationChanged).toBeTruthy();
    const completion = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 5],
      columns: ['finishDelta'],
      filter: { text: expected.milestone.code },
    });
    expect(completion.numbers.finishDelta![0]).toBe(expected.milestone.slipMinutes + FIVE_DAYS);
    expect(ask(session, { type: 'diff' }).counts.DurationChanged).toBe(
      before.counts.DurationChanged,
    );
  });

  it('puts everything back when an edit is reverted', () => {
    const session = loaded();
    session.handle({ type: 'cpm', slot: 'b' });
    const original = snapshot(session);
    const applied = ask(session, {
      type: 'applyEdit',
      taskCode: driver.code,
      field: 'originalDuration',
      to: driverDuration + FIVE_DAYS,
    });
    expect(snapshot(session)).not.toEqual(original);
    const reverted = ask(session, { type: 'revertEdit', editId: applied.edit.id });
    expect(reverted.applied).toBe(true);
    expect(reverted.editCount).toBe(0);
    expect(Array.from(reverted.changed)).toEqual(Array.from(applied.changed));
    expect(snapshot(session)).toEqual(original);
    expect(reverted.projectFinishAfter).toBe(applied.projectFinishBefore);
  });

  it('keeps later edits in force when an earlier one is reverted', () => {
    const session = loaded();
    const other = expected.drivers.find((entry) => entry.code !== driver.code)!;
    const first = ask(session, {
      type: 'applyEdit',
      taskCode: driver.code,
      field: 'originalDuration',
      to: driverDuration + FIVE_DAYS,
    });
    const second = ask(session, {
      type: 'applyEdit',
      taskCode: other.code,
      field: 'constraintType',
      to: ConstraintType.StartOnOrAfter,
    });
    expect(second.editCount).toBe(2);
    expect(first.edit.id).not.toBe(second.edit.id);
    ask(session, { type: 'revertEdit', editId: first.edit.id });
    const edits = ask(session, { type: 'edits' }).edits;
    expect(edits.map((edit) => edit.taskCode)).toEqual([other.code]);
    const row = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 5],
      columns: ['originalDuration'],
      filter: { text: driver.code },
    });
    expect(row.numbers.originalDuration![0]).toBe(driverDuration);
    const constrained = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 5],
      columns: ['constraintType'],
      filter: { text: other.code },
    });
    expect(constrained.numbers.constraintType![0]).toBe(ConstraintType.StartOnOrAfter);
  });

  it('applies a constraint: the activity cannot start before the date', () => {
    const session = loaded();
    session.handle({ type: 'cpm', slot: 'b' });
    const start = () =>
      ask(session, {
        type: 'rows',
        slot: 'b',
        range: [0, 5],
        columns: ['start'],
        filter: { text: driver.code },
      }).numbers.start![0]!;
    const planned = start();
    const later = planned + 30 * 1440; // the same weekday and time, thirty days on, give or take a weekend
    ask(session, { type: 'applyEdit', taskCode: driver.code, field: 'constraintDate', to: later });
    expect(start()).toBe(planned); // a date without a constraint type does nothing
    ask(session, {
      type: 'applyEdit',
      taskCode: driver.code,
      field: 'constraintType',
      to: ConstraintType.StartOnOrAfter,
    });
    expect(start()).toBeGreaterThanOrEqual(later);
    expect(start() - later).toBeLessThan(5 * 1440);
  });

  it('changes little when the edited activity has float to spare', () => {
    const session = loaded();
    session.handle({ type: 'cpm', slot: 'b' });
    const rows = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 2000],
      columns: ['code', 'totalFloat', 'type', 'status', 'originalDuration', 'calendar'],
    });
    const at = Array.from(rows.indices).findIndex(
      (_, k) =>
        rows.numbers.type![k] === TaskType.Task &&
        rows.numbers.status![k] === Status.NotStarted &&
        rows.numbers.totalFloat![k]! > 20 * 480 &&
        rows.numbers.calendar![k] === 0,
    );
    const result = ask(session, {
      type: 'applyEdit',
      activity: rows.indices[at]!,
      field: 'originalDuration',
      to: rows.numbers.originalDuration![at]! + 480,
    });
    expect(result.projectFinishAfter).toBe(result.projectFinishBefore);
    expect(result.milestones).toEqual([]);
    expect(result.changed.length).toBeGreaterThan(0);
    expect(result.changed.length).toBeLessThan(200);
  });

  it('replays a saved edit under its own id, and refuses to use an id twice', () => {
    const session = loaded();
    const result = ask(session, {
      type: 'applyEdit',
      taskCode: driver.code,
      field: 'originalDuration',
      to: driverDuration + 480,
      id: 'saved-7',
    });
    expect(result.edit.id).toBe('saved-7');
    refuses(
      session,
      {
        type: 'applyEdit',
        taskCode: driver.code,
        field: 'originalDuration',
        to: driverDuration,
        id: 'saved-7',
      },
      /already in use/,
    );
    expect(ask(session, { type: 'revertEdit', editId: 'saved-7' }).editCount).toBe(0);
  });

  it('refuses edits that make no sense, and says why', () => {
    const session = loaded();
    let finished = -1;
    let unstarted = -1;
    for (let j = 0; j < reference.n; j++) {
      if (finished < 0 && reference.status[j] === Status.Complete) finished = j;
      if (
        unstarted < 0 &&
        reference.status[j] === Status.NotStarted &&
        reference.type[j] === TaskType.Task
      )
        unstarted = j;
    }
    refuses(
      session,
      { type: 'applyEdit', taskCode: driver.code, field: 'taskName', to: 1 },
      /cannot be edited/,
    );
    refuses(
      session,
      { type: 'applyEdit', taskCode: driver.code, field: '__proto__', to: 1 },
      /cannot be edited/,
    );
    refuses(
      session,
      { type: 'applyEdit', taskCode: 'NO-SUCH', field: 'originalDuration', to: 480 },
      /not in the current update/,
    );
    refuses(
      session,
      { type: 'applyEdit', activity: finished, field: 'originalDuration', to: 480 },
      /finished/,
    );
    refuses(
      session,
      { type: 'applyEdit', taskCode: driver.code, field: 'originalDuration', to: -480 },
      /zero or more/,
    );
    refuses(
      session,
      { type: 'applyEdit', taskCode: driver.code, field: 'originalDuration', to: 12.5 },
      /whole number/,
    );
    refuses(
      session,
      { type: 'applyEdit', taskCode: driver.code, field: 'originalDuration', to: Number.NaN },
      /whole number/,
    );
    refuses(
      session,
      { type: 'applyEdit', taskCode: driver.code, field: 'originalDuration', to: 1e12 },
      /100 years/,
    );
    refuses(
      session,
      { type: 'applyEdit', taskCode: expected.milestone.code, field: 'originalDuration', to: 480 },
      /milestone/,
    );
    refuses(
      session,
      { type: 'applyEdit', activity: unstarted, field: 'remainingDuration', to: 480 },
      /not started/,
    );
    refuses(
      session,
      { type: 'applyEdit', taskCode: driver.code, field: 'constraintType', to: 77 },
      /Unknown constraint/,
    );
    refuses(
      session,
      { type: 'applyEdit', taskCode: driver.code, field: 'constraintDate', to: 3e9 },
      /out of range/,
    );
    refuses(session, { type: 'revertEdit', editId: 'nope' }, /no such edit/);
    expect(ask(session, { type: 'edits' }).edits).toEqual([]);
    // A constraint date can be cleared.
    expect(
      ask(session, { type: 'applyEdit', taskCode: driver.code, field: 'constraintDate', to: NONE })
        .applied,
    ).toBe(true);
  });

  it('never touches the imported schedule', () => {
    const session = new EngineSession();
    const data = parseXerText(textB);
    const durations = Array.from(data.originalDurationMin);
    session.handle({ type: 'load', slot: 'a', data: parseXerText(textA) });
    session.handle({ type: 'load', slot: 'b', data });
    ask(session, {
      type: 'applyEdit',
      taskCode: driver.code,
      field: 'originalDuration',
      to: driverDuration + FIVE_DAYS,
    });
    expect(Array.from(data.originalDurationMin)).toEqual(durations);
  });

  it('forgets edits when a new file is loaded, and only edits the current update', () => {
    const session = loaded();
    ask(session, {
      type: 'applyEdit',
      taskCode: driver.code,
      field: 'originalDuration',
      to: driverDuration + 480,
    });
    session.handle({ type: 'load', slot: 'b', data: parseXerText(textB) });
    expect(ask(session, { type: 'edits' }).edits).toEqual([]);
    const onlyA = new EngineSession();
    onlyA.handle({ type: 'load', slot: 'a', data: parseXerText(textA) });
    expect(() =>
      onlyA.handle({ type: 'applyEdit', activity: 5, field: 'originalDuration', to: 480 }),
    ).toThrowError(/not loaded/);
  });

  it('lists the changed activities for transfer', () => {
    const result = ask(loaded(), {
      type: 'applyEdit',
      taskCode: driver.code,
      field: 'originalDuration',
      to: driverDuration + 480,
    });
    expect(EngineSession.transferList(result)).toEqual([result.changed.buffer]);
  });
});
