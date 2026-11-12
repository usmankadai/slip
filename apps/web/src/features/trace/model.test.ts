import { describe, expect, it } from 'vitest';
import { TraceEnd } from '@slip/engine';
import { ALWAYS_LISTED, buildTrace, passedOnSentence, type TraceInput } from './model.ts';

/** A straight path of activities 10, 11, 12, ... leading to the milestone, activity 1. */
function chain(own: number[], extra: Partial<TraceInput> = {}): TraceInput {
  const count = own.length;
  const nodes = [1, ...own.map((_, k) => 10 + k).reverse()];
  let running = 0;
  const slipAt = own.map((days) => (running += days));
  return {
    slipWorkingDays: running,
    isNew: false,
    nodes,
    depth: nodes.map((_, k) => k),
    end: nodes.map((_, k) => (k === count ? TraceEnd.DataDate : TraceEnd.Driven)),
    codes: nodes.map((node) => (node === 1 ? 'MS' : `A${node}`)),
    names: nodes.map((node) => (node === 1 ? 'Milestone' : `Activity ${node}`)),
    slipDays: [running, ...slipAt.slice().reverse()],
    contributors: own
      .map((days, k) => ({ activity: 10 + k, kind: 'duration' as const, workingDays: days }))
      .filter((part) => part.workingDays !== 0),
    truncated: false,
    ...extra,
  };
}

describe('causes', () => {
  // The real case from the 1,000 activity fixture: four causes of a 67 day slip.
  const view = buildTrace(chain([0, 13, 0, 0, 16, 0, 18, 0, 20, 0]));

  it('ranks the causes largest first, with their share of the slip added', () => {
    expect(view.causes.map((cause) => cause.days)).toEqual([20, 18, 16, 13]);
    expect(view.causes.map((cause) => Math.round(cause.share! * 100))).toEqual([30, 27, 24, 19]);
    expect(view.causes[0]).toMatchObject({ code: 'A18', what: ['Duration grew'] });
    expect(view.minor).toEqual([]);
    expect(view.unexplained).toBe(0);
  });

  it('counts the activities that only passed the slip on', () => {
    expect(view.passedOn).toBe(6);
    expect(passedOnSentence(view)).toBe(
      '6 activities on the path passed the slip on without adding to it.',
    );
  });

  it('ranks a recovery by its size and gives it no share', () => {
    const messy = buildTrace(chain([0, 24, 2, 0, -12, 1, 15, 1, 9, 1, 0]));
    expect(messy.causes.map((cause) => cause.days)).toEqual([24, 15, -12, 9, 2]);
    expect(messy.causes[2]).toMatchObject({ share: null, what: ['Duration shortened'] });
    expect(Math.round(messy.causes[0]!.share! * 100)).toBe(45);
    expect(messy.minor.map((cause) => cause.days)).toEqual([1, 1, 1]);
    expect(messy.minorDays).toBe(3);
    expect(messy.slipDays).toBe(41);
  });

  it('always lists the largest few, however small they are', () => {
    const small = buildTrace(chain([1, 0.5, 1, 0.5, 1, 0.5, 1]));
    expect(small.causes).toHaveLength(ALWAYS_LISTED);
    expect(small.minor).toHaveLength(2);
  });

  it('lists every cause of three days or more, however many there are', () => {
    expect(buildTrace(chain([4, 5, 6, 7, 8, 9, 10, 1])).causes).toHaveLength(7);
  });

  it('adds up several kinds of change on one activity, and names the larger first', () => {
    const input = chain([10]);
    const both = buildTrace({
      ...input,
      contributors: [
        { activity: 10, kind: 'logic', workingDays: 3 },
        { activity: 10, kind: 'duration', workingDays: 7 },
      ],
    });
    expect(both.causes).toHaveLength(1);
    expect(both.causes[0]).toMatchObject({ days: 10, what: ['Duration grew', 'Logic changed'] });
  });

  it('says how much of the slip the causes do not account for', () => {
    expect(buildTrace(chain([10], { slipWorkingDays: 14 })).unexplained).toBe(4);
    expect(buildTrace(chain([10], { slipWorkingDays: 10.2 })).unexplained).toBe(0);
  });

  it('ignores contributions that are not numbers, and survives an empty trace', () => {
    const odd = buildTrace({
      ...chain([5]),
      contributors: [
        { activity: 10, kind: 'duration', workingDays: Number.NaN },
        { activity: 999, kind: 'not-a-kind' as never, workingDays: 2 },
      ],
    });
    expect(odd.causes).toEqual([
      { activity: 999, code: '', name: '', what: ['Changed'], days: 2, share: 1 },
    ]);
    const empty = buildTrace({
      ...chain([]),
      nodes: [],
      depth: [],
      end: [],
      codes: [],
      names: [],
      slipDays: [],
    });
    expect(empty).toMatchObject({ causes: [], path: [], begins: '', pathScale: 1 });
  });
});

describe('the driving path', () => {
  const view = buildTrace(chain([0, 13, 0, 0, 16, 0, 18, 0, 20, 0]));

  it('runs from furthest back to the milestone, folding activities that added nothing', () => {
    expect(
      view.path.map((step) => (step.kind === 'passed' ? `passed ${step.passed}` : step.code)),
    ).toEqual([
      'A10',
      'A11',
      'passed 2',
      'A14',
      'passed 1',
      'A16',
      'passed 1',
      'A18',
      'passed 1',
      'MS',
    ]);
    expect(view.path.at(-1)).toMatchObject({ target: true, inherited: 67, own: 0 });
  });

  it('separates what each activity inherited from what it added', () => {
    const a14 = view.path.find((step) => step.code === 'A14')!;
    expect(a14).toMatchObject({ inherited: 13, own: 16 });
    expect(view.pathScale).toBe(67);
  });

  it('keeps the first activity in view and says why the trace stops there', () => {
    expect(view.path[0]).toMatchObject({ code: 'A10', own: 0 });
    expect(view.path[0]!.stops).toContain('the data date');
    expect(view.begins).toBe('The driving path begins at the data date.');
  });

  it('says so when the paths begin in several places', () => {
    const input = chain([0, 5, 0]);
    const end = Array.from(input.end);
    end[1] = TraceEnd.Constraint;
    expect(buildTrace({ ...input, end }).begins).toBe(
      'The driving paths begin at the data date (1), a constraint (1).',
    );
  });

  it('has no inherited figure for an activity that cannot be compared', () => {
    const input = chain([0, 5]);
    const slipDays = [...input.slipDays];
    slipDays[1] = null;
    expect(
      buildTrace({ ...input, slipDays }).path.find((step) => step.code === 'A11')?.inherited,
    ).toBeNull();
  });
});
