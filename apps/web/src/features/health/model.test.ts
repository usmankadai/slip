import { describe, expect, it } from 'vitest';
import type { HealthSummary } from '@slip/engine';
import { compareHealth, healthHeadline, movementOf } from './model.ts';

const check = (id: number, over: Partial<HealthSummary> = {}): HealthSummary => ({
  id,
  name: `Check ${id}`,
  value: 0,
  unit: 'percent',
  threshold: 5,
  limit: 'max',
  pass: true,
  count: 0,
  population: 1000,
  ...over,
});

describe('movementOf', () => {
  it('is worse when a passing check starts to fail, and better the other way', () => {
    expect(movementOf(check(5), check(5, { pass: false, count: 63 }))).toBe('worse');
    expect(movementOf(check(1, { pass: false, count: 54 }), check(1, { count: 48 }))).toBe(
      'better',
    );
  });

  it('is worse when a failing check moves further from its threshold, and better when nearer', () => {
    const was = check(7, { pass: false, value: 286, count: 286 });
    expect(movementOf(was, check(7, { pass: false, value: 622, count: 622 }))).toBe('worse');
    expect(movementOf(was, check(7, { pass: false, value: 100, count: 100 }))).toBe('better');
    expect(movementOf(was, check(7, { pass: false, value: 286, count: 286 }))).toBe('same');
  });

  it('judges a share on the share, not on how many are counted', () => {
    // Fewer activities counted, but a larger share of a smaller schedule.
    const was = check(1, { pass: false, value: 15.2, count: 1520 });
    expect(movementOf(was, check(1, { pass: false, value: 15.6, count: 1505 }))).toBe('worse');
  });

  it('reads a check that must stay above its threshold the other way round', () => {
    const types = (value: number) => check(4, { limit: 'min', threshold: 90, pass: false, value });
    expect(movementOf(types(88), types(85))).toBe('worse');
    expect(movementOf(types(85), types(88))).toBe('better');
  });

  it('falls back to the count when a figure is missing', () => {
    const was = check(7, { pass: false, value: null, count: 5 });
    expect(movementOf(was, check(7, { pass: false, value: null, count: 9 }))).toBe('worse');
    expect(movementOf(was, check(7, { pass: false, value: null, count: 5 }))).toBe('same');
  });

  it('is unchanged when it passes in both, whatever the figures did', () => {
    expect(movementOf(check(3, { count: 20 }), check(3, { count: 40 }))).toBe('same');
  });

  it('judges a failing index on its value, since it has no count', () => {
    const index = (value: number | null) =>
      check(13, { unit: 'ratio', threshold: 0.95, limit: 'min', pass: false, value });
    expect(movementOf(index(0.91), index(0.88))).toBe('worse');
    expect(movementOf(index(0.88), index(0.91))).toBe('better');
    expect(movementOf(index(0.9), index(0.9))).toBe('same');
  });

  it('does not compare a check that is reported only, not assessed, or missing from update A', () => {
    expect(movementOf(check(12, { pass: null }), check(12, { pass: null }))).toBe('not-compared');
    expect(movementOf(check(9), check(9, { pass: null, value: null }))).toBe('not-compared');
    expect(movementOf(undefined, check(2))).toBe('not-compared');
  });
});

describe('compareHealth', () => {
  const a = [
    check(1, { name: 'Missing logic', pass: false, value: 5.4, count: 54 }),
    check(2, { name: 'Leads', unit: 'count', threshold: 0, value: 0 }),
    check(5, { name: 'Hard constraints', value: 4.1, count: 41 }),
    check(7, {
      name: 'Negative float',
      unit: 'count',
      threshold: 0,
      pass: false,
      value: 286,
      count: 286,
    }),
    check(10, { name: 'Resources', pass: null, value: null, threshold: null, limit: null }),
    check(13, {
      name: 'Critical path length index',
      unit: 'ratio',
      threshold: 0.95,
      limit: 'min',
      pass: false,
      value: 0.91,
    }),
  ];
  const b = [
    check(13, {
      name: 'Critical path length index',
      unit: 'ratio',
      threshold: 0.95,
      limit: 'min',
      pass: false,
      value: 0.88,
    }),
    check(1, { name: 'Missing logic', value: 4.8, count: 48 }),
    check(2, { name: 'Leads', unit: 'count', threshold: 0, value: 0 }),
    check(5, { name: 'Hard constraints', pass: false, value: 6.3, count: 63 }),
    check(7, {
      name: 'Negative float',
      unit: 'count',
      threshold: 0,
      pass: false,
      value: 622,
      count: 622,
    }),
    check(10, {
      name: 'Resources',
      pass: null,
      value: null,
      threshold: null,
      limit: null,
      note: 'Not read yet.',
    }),
  ];
  const view = compareHealth(a, b);

  it('sorts the checks into worse, better and the rest, each in DCMA order', () => {
    expect(view.worse.map((row) => row.id)).toEqual([5, 7, 13]);
    expect(view.better.map((row) => row.id)).toEqual([1]);
    expect(view.rest.map((row) => row.id)).toEqual([2, 10]);
    expect(view.failing).toBe(3);
    expect(view.compared).toBe(5);
    expect(healthHeadline(view)).toBe('3 checks got worse, 1 got better');
  });

  it('writes each figure in its own unit, with the rule it is judged by', () => {
    expect(view.worse[0]).toMatchObject({
      was: '4.1%',
      now: '6.3%',
      rule: 'Passes at 5% or less',
      change: '+2.2 points (+22 activities)',
    });
    expect(view.worse[1]).toMatchObject({
      was: '286',
      now: '622',
      rule: 'Passes at none',
      change: '+336 activities',
    });
    expect(view.worse[2]).toMatchObject({
      was: '0.91',
      now: '0.88',
      rule: 'Passes at 0.95 or more',
      change: '−0.03',
    });
    expect(view.better[0]).toMatchObject({ change: '−0.6 points (−6 activities)', passes: true });
  });

  it('never calls an unassessed check passing, and carries its note', () => {
    expect(view.rest[1]).toMatchObject({
      was: 'Not assessed',
      now: 'Not assessed',
      rule: 'Reported only',
      passes: null,
      movement: 'not-compared',
      note: 'Not read yet.',
      hasOffenders: false,
    });
  });

  it('counts relationships for the relationship checks', () => {
    const lags = compareHealth(
      [check(3, { pass: false, value: 6, count: 10 })],
      [check(3, { pass: false, value: 7, count: 11 })],
    );
    expect(lags.worse[0]!.change).toBe('+1.0 points (+1 relationship)');
  });

  it('has a headline for every outcome', () => {
    expect(healthHeadline(compareHealth([check(1)], [check(1)]))).toBe(
      'No check got worse or better',
    );
    expect(healthHeadline(compareHealth([], [check(1)]))).toBe(
      'The checks could not be compared between these updates',
    );
    expect(healthHeadline(compareHealth([check(1)], [check(1, { pass: false, count: 9 })]))).toBe(
      '1 check got worse',
    );
    expect(healthHeadline(compareHealth([check(1, { pass: false, count: 9 })], [check(1)]))).toBe(
      '1 check got better',
    );
  });

  it('survives an empty update', () => {
    expect(compareHealth([], [])).toEqual({
      worse: [],
      better: [],
      rest: [],
      failing: 0,
      compared: 0,
    });
  });
});
