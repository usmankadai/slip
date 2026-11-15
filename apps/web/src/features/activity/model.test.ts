import { describe, expect, it } from 'vitest';
import { Change, type ActivityDetail, type LinkDetail } from '@slip/engine';
import { ConstraintType, NONE, RelType, Status, TaskType } from '@slip/xer';
import type { TraceView } from '../trace/model.ts';
import { activityModel, whySentence, type ActivityAnswer } from './model.ts';

const DAY = 480; // an 8 hour working day, in minutes
const D = 24 * 60; // a calendar day, in minutes
const JUNE = 9_649 * D;

const link = (code: string, type: number = RelType.FS, lagDays = 0): LinkDetail => ({
  taskCode: code,
  name: `Name of ${code}`,
  type,
  lagMinutes: lagDays * DAY,
});

function detail(over: Partial<ActivityDetail> = {}): ActivityDetail {
  return {
    index: 0,
    taskCode: 'P01-A001-TRK-1000',
    name: 'Install catenary, section 2',
    wbs: 'Section 2',
    type: TaskType.Task,
    status: Status.NotStarted,
    calendar: 0,
    dayMinutes: DAY,
    start: JUNE,
    finish: JUNE + 20 * D,
    earlyStart: JUNE,
    earlyFinish: JUNE + 20 * D,
    actualStart: NONE,
    actualFinish: NONE,
    originalDuration: 18 * DAY,
    remainingDuration: 18 * DAY,
    totalFloat: 12 * DAY,
    constraintType: ConstraintType.None,
    constraintDate: NONE,
    predecessors: [link('A'), link('B', RelType.SS, 3), link('C')],
    successors: [link('S')],
    predecessorCount: 3,
    successorCount: 1,
    ...over,
  };
}

function answer(over: Partial<ActivityAnswer> = {}): ActivityAnswer {
  return {
    taskCode: 'P01-A001-TRK-1000',
    previous: detail(),
    current: detail(),
    flags: 0,
    finishDelta: 0,
    startDelta: 0,
    durationDelta: 0,
    floatDelta: 0,
    ...over,
  };
}

describe('the activity drawer', () => {
  it('puts the fields that changed first, with how they changed', () => {
    const model = activityModel(
      answer({
        current: detail({
          originalDuration: 29 * DAY,
          remainingDuration: 29 * DAY,
          totalFloat: -4 * DAY,
          constraintType: ConstraintType.FinishOnOrBefore,
          constraintDate: JUNE + 60 * D,
        }),
        flags: Change.FinishMoved | Change.DurationChanged | Change.JoinedCriticalPath,
        finishDelta: 67 * DAY,
        startDelta: 56 * DAY,
        floatDelta: -16 * DAY,
      }),
    )!;
    expect(model.slipDays).toBe(67);
    expect(model.critical).toBe('Now critical');
    expect(model.changedCount).toBe(6);
    expect(model.fields.slice(0, 6).map((f) => [f.label, f.change])).toEqual([
      ['Finish', '+67d'],
      ['Start', '+56d'],
      ['Original duration', '+11d'],
      ['Remaining duration', '+11d'],
      ['Total float', '−16d'],
      ['Constraint', 'Added'],
    ]);
    expect(model.fields[2]).toMatchObject({ was: '18d', now: '29d' });
    expect(model.fields[5]?.now).toBe('Finish on or before 1 Aug 2026');
    expect(model.fields.slice(6).every((f) => !f.changed)).toBe(true);
  });

  it('lists links added, removed and changed when both lists are complete', () => {
    const model = activityModel(
      answer({
        current: detail({
          predecessors: [link('A'), link('B', RelType.FS, 0), link('N')],
          successors: [],
          successorCount: 0,
        }),
        flags: Change.LogicChanged,
      }),
    )!;
    expect(model.logicChanged).toBe(true);
    expect(model.linkChanges?.map((l) => [l.side, l.change, l.code, l.type, l.lag])).toEqual([
      ['Predecessor', 'Changed', 'B', 'FS', '0d'],
      ['Predecessor', 'Added', 'N', 'FS', '0d'],
      ['Predecessor', 'Removed', 'C', 'FS', '0d'],
      ['Successor', 'Removed', 'S', 'FS', '0d'],
    ]);
  });

  it('does not guess at link changes when the engine listed only some links', () => {
    const many = Array.from({ length: 30 }, (_, k) => link(`L${k}`));
    const model = activityModel(
      answer({
        previous: detail({ predecessors: many, predecessorCount: 45 }),
        current: detail({ predecessors: many, predecessorCount: 46 }),
        flags: Change.LogicChanged,
      }),
    )!;
    expect(model.linkChanges).toBeNull();
    expect(model.logicChanged).toBe(true);
    expect(model.predecessorCount).toBe(46);
  });

  it('shows a new activity with no update A values and nothing marked as changed', () => {
    const model = activityModel(
      answer({ previous: null, flags: Change.Added, finishDelta: NONE }),
    )!;
    expect(model.isNew).toBe(true);
    expect(model.slipDays).toBeNull();
    expect(model.changedCount).toBe(0);
    expect(model.linkChanges).toEqual([]);
    expect(model.fields.every((f) => f.was === '' && !f.changed)).toBe(true);
  });

  it('marks nothing on an activity that did not change', () => {
    const model = activityModel(answer())!;
    expect(model.slipDays).toBe(0);
    expect(model.changedCount).toBe(0);
    expect(model.linkChanges).toEqual([]);
  });

  it('is null for an activity not in update B', () => {
    expect(activityModel(answer({ current: null }))).toBeNull();
  });

  it('names calendars through the lookup it is given', () => {
    const model = activityModel(answer(), (i) => (i === 0 ? '5 day' : ''))!;
    expect(model.fields.find((f) => f.label === 'Calendar')?.now).toBe('5 day');
  });

  it('keeps schedule text as plain text', () => {
    const model = activityModel(answer({ current: detail({ name: '<img src=x onerror=1>' }) }))!;
    expect(model.name).toBe('<img src=x onerror=1>');
  });
});

describe('why it moved', () => {
  const trace = (over: Partial<TraceView>): TraceView =>
    ({
      slipDays: 67,
      causes: [],
      minor: [],
      minorDays: 0,
      passedOn: 0,
      unexplained: 0,
      path: [],
      begins: '',
      truncated: false,
      ...over,
    }) as TraceView;
  const cause = (code: string, what: string, days: number) => ({
    activity: 1,
    code,
    name: `Name of ${code}`,
    what: [what],
    days,
    share: null,
  });

  it('names the two largest causes, calling the activity itself "this activity"', () => {
    expect(
      whySentence(
        trace({
          causes: [cause('N', 'New activity', 45), cause('X', 'Duration grew', 11)],
          minor: [cause('M', 'Logic changed', 1)],
        }),
        'X',
      ),
    ).toBe(
      'The largest causes are Name of N (new activity, +45d) and this activity (duration grew, +11d). 1 more activity also moved it.',
    );
  });

  it('says so when the trace finds no cause, and says nothing when it did not move', () => {
    expect(whySentence(trace({}), 'X')).toMatch(/^The trace found no activity/);
    expect(whySentence(trace({ slipDays: 0 }), 'X')).toBeNull();
  });
});
