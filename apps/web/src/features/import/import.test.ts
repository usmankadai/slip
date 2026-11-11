import { describe, expect, it } from 'vitest';
import type { ImportWarning } from '@slip/xer';
import { errorCopy, rejectBeforeReading } from './errors.ts';
import { apart, longDate, megabytes, plural, share } from './format.ts';
import { checkPair, type PairFacts } from './pair.ts';
import {
  compareBlocker,
  EMPTY_STATE,
  MAX_FILE_BYTES,
  type ImportState,
  type SlotFacts,
} from './types.ts';
import { buildReport } from './warnings.ts';

const DAY = 24 * 60;
// Minutes since the epoch for two data dates a month apart. Only the difference matters here.
const JUNE = 9_000 * DAY;
const JULY = JUNE + 30 * DAY;

const TOTALS = { activities: 350_412, relationships: 498_864, rows: 2_104_880 };

describe('format', () => {
  it('writes counts with a unit and the right plural', () => {
    expect(plural(1, 'warning')).toBe('1 warning');
    expect(plural(3012, 'warning')).toBe('3,012 warnings');
    expect(plural(1, 'activity', 'activities')).toBe('1 activity');
    expect(plural(0, 'activity', 'activities')).toBe('0 activities');
  });

  it('gives a share that never rounds to nothing', () => {
    expect(share(96, 498_864)).toBe('0.02%');
    expect(share(2, 498_864)).toBe('under 0.01%');
  });

  it('writes megabytes without reading a small file as 0', () => {
    expect(megabytes(84_000_000)).toBe('84');
    expect(megabytes(1_240_000)).toBe('1.2');
  });

  it('says how far apart two data dates are', () => {
    expect(apart(JUNE, JULY)).toBe('one month apart');
    expect(apart(JUNE, JUNE + 12 * DAY)).toBe('12 days apart');
    expect(apart(JUNE, JUNE + DAY)).toBe('1 day apart');
  });

  it('writes a date in words, and says so when there is none', () => {
    expect(longDate(JUNE)).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
    expect(longDate(-2147483648)).toBe('no data date');
  });
});

describe('buildReport', () => {
  const warnings: ImportWarning[] = [
    { kind: 'row-field-count', count: 2412, examples: ['TASK line 118204'] },
    { kind: 'unknown-task-type', count: 321, examples: [] },
    { kind: 'duplicate-task-code', count: 143, examples: ['P02-A003-CIV-0160'] },
    { kind: 'relationship-missing-task', count: 96, examples: ['P03-A005-ENB-0200'] },
    { kind: 'missing-calendar', count: 38, examples: ['P01-A001-TRK-0060'] },
  ];

  it('leads with what may change dates, however few', () => {
    const report = buildReport(warnings, TOTALS);
    expect(report.total).toBe(3010);
    expect(report.kinds).toBe(5);
    expect(report.groups.map((group) => group.id)).toEqual(['dates', 'compare', 'repair']);
    expect(report.groups[0]!.total).toBe(134);
    expect(report.groups[0]!.rows.map((row) => row.kind)).toEqual([
      'relationship-missing-task',
      'missing-calendar',
    ]);
  });

  it('gives each count its share of the schedule', () => {
    const report = buildReport(warnings, TOTALS);
    expect(report.groups[0]!.rows[0]!.share).toBe('0.02% of 498,864 relationships');
    expect(report.groups[2]!.rows[0]!.share).toBe('0.11% of 2,104,880 rows');
  });

  it('leaves the share out when the total is not known', () => {
    const report = buildReport(warnings, { ...TOTALS, rows: 0 });
    expect(report.groups[2]!.rows[0]!.share).toBe('');
  });

  it('is empty for a clean file and leaves out groups with nothing in them', () => {
    expect(buildReport([], TOTALS)).toEqual({ total: 0, kinds: 0, groups: [] });
    expect(buildReport([warnings[2]!], TOTALS).groups.map((group) => group.id)).toEqual([
      'compare',
    ]);
  });

  it('shows a kind it has no wording for, and survives bad counts and too many examples', () => {
    const odd = [
      {
        kind: 'something-new',
        count: 4,
        examples: Array.from({ length: 50 }, (_, i) => `row ${i}`),
      },
      { kind: 'missing-wbs', count: Number.NaN, examples: [] },
      { kind: '__proto__', count: 1, examples: ['', '  '] },
    ] as unknown as ImportWarning[];
    const report = buildReport(odd, TOTALS);
    expect(report.total).toBe(5);
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]!.rows[0]!.name).toBe('Another kind of warning');
    expect(report.groups[0]!.rows[0]!.examples).toHaveLength(20);
    expect(report.groups[0]!.rows[1]!.examples).toEqual([]);
  });
});

describe('checkPair', () => {
  const a: PairFacts = {
    projectName: 'Northern Rail',
    dataDate: JUNE,
    sourceHash: 'aa',
    activities: 1000,
  };
  const b: PairFacts = {
    projectName: 'Northern Rail',
    dataDate: JULY,
    sourceHash: 'bb',
    activities: 1010,
  };

  it('says a sound pair is sound, in a full sentence', () => {
    const check = checkPair(a, b, 990);
    expect(check.kind).toBe('sound');
    expect(check.sentence).toBe(
      'Same project, one month apart. 990 activities are in both updates.',
    );
    expect(check.blocks).toBe(false);
  });

  it('offers no comparison for the same file twice', () => {
    const check = checkPair(a, { ...b, sourceHash: 'aa' }, 1000);
    expect(check.kind).toBe('same-file');
    expect(check.blocks).toBe(true);
  });

  it('does not treat two schedules without a hash as the same file', () => {
    expect(checkPair({ ...a, sourceHash: '' }, { ...b, sourceHash: '' }, 990).kind).toBe('sound');
  });

  it('warns about a wrong order without blocking', () => {
    const check = checkPair({ ...a, dataDate: JULY }, { ...b, dataDate: JUNE }, 990);
    expect(check.kind).toBe('wrong-order');
    expect(check.blocks).toBe(false);
  });

  it('calls it a different schedule only when the name differs and under 20% of codes match', () => {
    const renamed = { ...b, projectName: 'Depot fit-out' };
    expect(checkPair(a, renamed, 40).kind).toBe('different');
    expect(checkPair(a, renamed, 990).kind).toBe('sound');
    expect(checkPair(a, b, 40).kind).toBe('sound');
    expect(checkPair(a, { ...renamed, activities: 0 }, 0).kind).toBe('different');
  });

  it('has its own wording for two updates with the same data date', () => {
    expect(checkPair(a, { ...b, dataDate: JUNE }, 990).kind).toBe('same-date');
  });
});

describe('errors', () => {
  it('rejects an empty file and one over the limit before reading', () => {
    expect(rejectBeforeReading({ name: 'a.xer', size: 0 })?.title).toBe('This file is empty');
    expect(rejectBeforeReading({ name: 'a.xer', size: MAX_FILE_BYTES + 1 })?.title).toBe(
      'This file is larger than Slip can read',
    );
    expect(rejectBeforeReading({ name: 'a.xer', size: MAX_FILE_BYTES })).toBeNull();
  });

  it('names the file, and offers another try only when that could help', () => {
    expect(errorCopy('not-xer', 'programme.xlsx').detail).toContain('programme.xlsx');
    expect(errorCopy('not-xer', 'x').retry).toBe(false);
    expect(errorCopy('failed', 'x').retry).toBe(true);
    expect(errorCopy('out-of-memory', 'x').retry).toBe(true);
  });
});

describe('compareBlocker', () => {
  const facts: SlotFacts = {
    fileName: 'a.xer',
    projectName: 'Northern Rail',
    projectId: 1,
    dataDate: JUNE,
    activities: 1000,
    relationships: 1200,
    sourceHash: 'aa',
    projects: [],
    incomplete: false,
    incompleteAccepted: false,
    report: { total: 0, kinds: 0, groups: [] },
  };
  const ready: ImportState = {
    a: { status: 'ready', facts },
    b: { status: 'ready', facts: { ...facts, sourceHash: 'bb', dataDate: JULY } },
    pair: { status: 'checked', check: { kind: 'sound', sentence: '', blocks: false } },
    generating: false,
  };

  it('allows a sound pair', () => {
    expect(compareBlocker(ready)).toBe('');
  });

  it('says which update is missing', () => {
    expect(compareBlocker(EMPTY_STATE)).toBe('Needs update A');
    expect(compareBlocker({ ...ready, b: { status: 'empty' } })).toBe('Needs update B');
  });

  it('waits for an answer about an incomplete file, then allows it', () => {
    const incomplete = { ...facts, incomplete: true };
    expect(compareBlocker({ ...ready, a: { status: 'ready', facts: incomplete } })).toBe(
      'Waiting for an answer about update A',
    );
    expect(
      compareBlocker({
        ...ready,
        a: { status: 'ready', facts: { ...incomplete, incompleteAccepted: true } },
      }),
    ).toBe('');
  });

  it('does not block on warnings about the pair, except when there is nothing to compare', () => {
    const warn = { kind: 'wrong-order', sentence: '', blocks: false } as const;
    expect(compareBlocker({ ...ready, pair: { status: 'checked', check: warn } })).toBe('');
    const same = { kind: 'same-file', sentence: '', blocks: true } as const;
    expect(compareBlocker({ ...ready, pair: { status: 'checked', check: same } })).toBe(
      'Nothing to compare',
    );
  });

  it('lets the planner go on if the pair check itself failed', () => {
    expect(compareBlocker({ ...ready, pair: { status: 'failed' } })).toBe('');
  });
});
