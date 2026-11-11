import { describe, expect, it } from 'vitest';
import type { HealthSummary } from '@slip/engine';
import type { SlotFacts } from '../import/types.ts';
import { buildReport } from '../import/warnings.ts';
import {
  MILESTONE_ROWS,
  carriedNotices,
  changeLines,
  criticalSentence,
  healthDelta,
  healthSentence,
  milestoneHeading,
  milestoneList,
  nothingChanged,
  recalculationNotice,
  type ChangeCounts,
  type MilestoneRow,
} from './model.ts';

const row = (code: string, days: number): MilestoneRow => ({
  code,
  name: code,
  was: 0,
  now: 0,
  days,
});
const many = (n: number, days: number) =>
  Array.from({ length: n }, (_, i) => row(`M${days}${i}`, days));

describe('milestoneList', () => {
  it('lists later moves first, then earlier, each largest first', () => {
    const later = [row('A', 67), row('B', 27), row('C', -10), row('D', -24)];
    const earlier = [row('D', -24), row('C', -10), row('B', 27), row('A', 67)];
    const list = milestoneList(later, earlier, 4, 9);
    expect(list.rows.map((r) => r.code)).toEqual(['A', 'B', 'D', 'C']);
    expect([list.later, list.earlier]).toEqual([2, 2]);
    expect(milestoneHeading(list)).toBe('4 milestones moved');
  });

  it('cuts to the largest moves and counts the split when one side was seen whole', () => {
    const list = milestoneList(
      many(MILESTONE_ROWS, 30),
      [row('E', -5), ...many(19, 30)],
      412,
      3000,
    );
    expect(list.rows).toHaveLength(MILESTONE_ROWS);
    expect(list.rows.every((r) => r.days > 0)).toBe(true);
    expect([list.later, list.earlier]).toEqual([411, 1]);
    expect(milestoneHeading(list)).toBe('412 milestones moved: 411 later, 1 earlier');
  });

  it('does not guess the split when neither side was seen whole', () => {
    const list = milestoneList(many(MILESTONE_ROWS, 30), many(MILESTONE_ROWS, -30), 900, 3000);
    expect([list.later, list.earlier]).toEqual([null, null]);
    expect(milestoneHeading(list)).toBe('900 milestones moved');
  });

  it('leaves out a milestone that moved by no working time', () => {
    expect(milestoneList([row('Z', 0)], [row('Z', 0)], 1, 5).rows).toEqual([]);
  });

  it('has a heading for no move and for no milestones', () => {
    expect(milestoneHeading(milestoneList([], [], 0, 42))).toBe('No milestone moved');
    expect(milestoneHeading(milestoneList([], [], 0, 0))).toBe('This schedule has no milestones');
    expect(milestoneHeading(milestoneList([row('A', 3)], [], 1, 1))).toBe('1 milestone moved');
  });
});

const COUNTS: ChangeCounts = {
  datesMoved: 4812,
  durationChanged: 312,
  logicChanged: 96,
  constraintChanged: 12,
  progressed: 2240,
  added: 412,
  removed: 130,
  activities: 350_412,
  joinedCritical: 14,
  leftCritical: 6,
};
const ZERO: ChangeCounts = {
  ...COUNTS,
  datesMoved: 0,
  durationChanged: 0,
  logicChanged: 0,
  constraintChanged: 0,
  progressed: 0,
  added: 0,
  removed: 0,
  joinedCritical: 0,
  leftCritical: 0,
};

describe('changes', () => {
  it('lists seven kinds of change', () => {
    expect(changeLines(COUNTS).map((line) => line.value)).toEqual([
      4812, 312, 96, 12, 2240, 412, 130,
    ]);
  });

  it('knows when nothing changed at all', () => {
    expect(nothingChanged(COUNTS)).toBe(false);
    expect(nothingChanged(ZERO)).toBe(true);
    expect(nothingChanged({ ...ZERO, removed: 1 })).toBe(false);
  });

  it('says what joined and left the critical path', () => {
    expect(criticalSentence(COUNTS)).toBe('14 activities joined, 6 left.');
    expect(criticalSentence({ ...COUNTS, joinedCritical: 1, leftCritical: 0 })).toBe(
      '1 activity joined, 0 left.',
    );
    expect(criticalSentence(ZERO)).toBe('No activity joined or left the critical path.');
  });
});

const check = (
  id: number,
  pass: boolean | null,
  count: number,
  name = `Check ${id}`,
): HealthSummary => ({
  id,
  name,
  value: null,
  unit: 'count',
  threshold: null,
  limit: null,
  pass,
  count,
  population: 100,
});

describe('healthDelta', () => {
  it('counts a check as worse when it starts failing or fails by more', () => {
    const a = [
      check(1, true, 0),
      check(2, false, 5),
      check(3, false, 9),
      check(4, true, 0),
      check(5, null, 0),
    ];
    const b = [
      check(1, false, 3),
      check(2, false, 17, 'Hard constraints'),
      check(3, false, 2),
      check(4, true, 0),
      check(5, null, 0),
    ];
    const delta = healthDelta(a, b);
    expect(delta).toEqual({
      worse: 2,
      better: 1,
      failing: 3,
      assessed: 4,
      worst: 'Hard constraints, 12 more than in update A',
    });
    expect(healthSentence(delta)).toBe(
      '2 checks worse, 1 better. Worst: Hard constraints, 12 more than in update A.',
    );
  });

  it('says so when nothing changed, and when nothing can be compared', () => {
    const same = [check(1, true, 0), check(2, false, 5)];
    expect(healthSentence(healthDelta(same, same))).toBe(
      'All 2 checks are as they were. 1 fail in update B.',
    );
    expect(healthSentence(healthDelta([], [check(1, null, 0)]))).toBe(
      'The checks could not be compared between these updates.',
    );
  });

  it('ignores a check that is missing from update A', () => {
    expect(healthDelta([], [check(9, false, 4)])).toMatchObject({
      worse: 0,
      better: 0,
      assessed: 0,
    });
  });
});

describe('notices', () => {
  const totals = { activities: 1000, relationships: 1200, rows: 0 };
  const facts = (over: Partial<SlotFacts> = {}): SlotFacts => ({
    fileName: 'a.xer',
    projectName: 'Northern Rail',
    projectId: 1,
    dataDate: 0,
    activities: 1000,
    relationships: 1200,
    sourceHash: 'aa',
    projects: [],
    incomplete: false,
    incompleteAccepted: false,
    report: buildReport([], totals),
    ...over,
  });

  it('carries nothing for clean files', () => {
    expect(carriedNotices({ a: facts(), b: facts() })).toEqual([]);
  });

  it('carries an incomplete file, and warnings that may change dates, but not repairs', () => {
    const report = buildReport(
      [
        { kind: 'truncated-file', count: 1, examples: [] },
        { kind: 'relationship-missing-task', count: 96, examples: [] },
        { kind: 'row-field-count', count: 2412, examples: [] },
      ],
      totals,
    );
    const notices = carriedNotices({
      a: facts(),
      b: facts({ incomplete: true, incompleteAccepted: true, report }),
    });
    expect(notices).toHaveLength(2);
    expect(notices[0]).toContain('Update B is incomplete');
    expect(notices[1]).toBe('96 import warnings in update B may change dates.');
  });

  it('mentions the recalculation only when it differs', () => {
    expect(recalculationNotice(0)).toBe('');
    expect(recalculationNotice(12)).toContain('12 activities');
  });
});
