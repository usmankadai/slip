import { describe, expect, it } from 'vitest';
import {
  Change,
  EngineError,
  EngineSession,
  type EngineRequest,
  type EngineResult,
} from '@slip/engine';
import { NONE, Status, formatXerDate, parseXerText } from '@slip/xer';
import { generatePair, xerText } from '../src/index.ts';

const pair = generatePair({ activities: 1000, seed: 42, sector: 'rail' });
const textA = xerText(pair.update01);
const textB = xerText(pair.update02);
const { expected } = pair;

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

describe('EngineSession', () => {
  it('reports what it loaded and refuses work on an update that is not there', () => {
    const session = new EngineSession();
    const result = ask(session, { type: 'load', slot: 'a', data: parseXerText(textA) });
    expect(result).toMatchObject({
      slot: 'a',
      activities: 1000,
      relationships: expected.update01.relationships,
    });
    expect(() => session.handle({ type: 'cpm', slot: 'b' })).toThrowError(EngineError);
    try {
      session.handle({ type: 'diff' });
      expect.unreachable();
    } catch (error) {
      expect((error as EngineError).code).toBe('not-loaded');
    }
  });

  it('runs CPM and agrees with the dates in a generated file', () => {
    const session = loaded();
    const summary = ask(session, { type: 'cpm', slot: 'b' });
    expect(summary.differsFromFile).toBe(0);
    expect(summary.loopActivities).toBe(0);
    expect(summary.critical).toBeGreaterThan(0);
    expect(formatXerDate(summary.dataDate)).toBe(expected.update02.dataDate);
  });

  it('summarises the diff with the counts the generator recorded', () => {
    const summary = ask(loaded(), { type: 'diff' });
    expect(summary.counts.Added).toBe(expected.changes.added.length);
    expect(summary.counts.Removed).toBe(expected.changes.removed.length);
    expect(summary.counts.DurationChanged).toBe(expected.changes.durationChanged.length);
    expect(summary.activitiesB).toBe(expected.update02.activities);
  });

  it('returns only the rows and columns asked for', () => {
    const session = loaded();
    const rows = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [10, 15],
      columns: ['code', 'finish', 'finishDelta'],
    });
    expect(rows.range).toEqual([10, 15]);
    expect(rows.total).toBe(expected.update02.activities);
    expect(rows.unfiltered).toBe(rows.total);
    expect(Array.from(rows.indices)).toEqual([10, 11, 12, 13, 14]);
    expect(Object.keys(rows.text)).toEqual(['code']);
    expect(Object.keys(rows.numbers).sort()).toEqual(['finish', 'finishDelta']);
    expect(rows.text.code).toHaveLength(5);
    expect(rows.numbers.finish).toHaveLength(5);
  });

  it('clamps a range that runs past the end, and caps very large requests', () => {
    const session = loaded();
    const tail = ask(session, { type: 'rows', slot: 'b', range: [995, 5000], columns: ['code'] });
    expect(tail.range).toEqual([995, tail.total]);
    expect(
      ask(session, { type: 'rows', slot: 'b', range: [9000, 9010], columns: ['code'] }).indices
        .length,
    ).toBe(0);
    const big = generatePair({ activities: 5000, seed: 1, sector: 'rail' });
    const other = new EngineSession();
    other.handle({ type: 'load', slot: 'b', data: parseXerText(xerText(big.update02)) });
    expect(
      ask(other, { type: 'rows', slot: 'b', range: [0, 5000], columns: ['code'] }).indices.length,
    ).toBe(2000);
  });

  it('filters to changed activities and says how many are hidden', () => {
    const session = loaded();
    const changed = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 2000],
      columns: ['flags'],
      filter: { changedOnly: true },
    });
    expect(changed.total).toBe(ask(session, { type: 'diff' }).changed);
    expect(changed.unfiltered - changed.total).toBeGreaterThan(0);
    expect(changed.numbers.flags!.every((flags) => flags !== 0)).toBe(true);

    const added = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 100],
      columns: ['code'],
      filter: { flagsAny: Change.Added },
    });
    expect([...added.text.code!].sort()).toEqual([...expected.changes.added].sort());
  });

  it('filters by status, by critical, and by text in the code or name', () => {
    const session = loaded();
    const done = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 2000],
      columns: ['status'],
      filter: { status: [Status.Complete] },
    });
    expect(done.total).toBeGreaterThan(0);
    expect(done.numbers.status!.every((status) => status === Status.Complete)).toBe(true);

    const critical = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 2000],
      columns: ['totalFloat', 'status'],
      filter: { critical: true },
    });
    expect(critical.total).toBeGreaterThan(0);
    expect(critical.numbers.totalFloat!.every((float) => float !== NONE && float <= 0)).toBe(true);

    const byCode = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 10],
      columns: ['code'],
      filter: { text: 'ms-complete' },
    });
    expect(byCode.text.code).toEqual(['MS-COMPLETE']);
    const byName = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 2000],
      columns: ['name'],
      filter: { text: 'BALLAST' },
    });
    expect(byName.total).toBeGreaterThan(0);
    expect(byName.text.name!.every((name) => name.toLowerCase().includes('ballast'))).toBe(true);
    expect(
      ask(session, {
        type: 'rows',
        slot: 'b',
        range: [0, 10],
        columns: ['code'],
        filter: { text: 'no such thing' },
      }).total,
    ).toBe(0);
  });

  it('sorts by a number column with missing values last in both directions', () => {
    const session = loaded();
    for (const direction of ['asc', 'desc'] as const) {
      const rows = ask(session, {
        type: 'rows',
        slot: 'b',
        range: [0, 2000],
        columns: ['finishDelta'],
        sort: { column: 'finishDelta', direction },
      });
      const values = Array.from(rows.numbers.finishDelta!);
      const firstMissing = values.indexOf(NONE);
      const present = firstMissing < 0 ? values : values.slice(0, firstMissing);
      expect(values.slice(present.length).every((value) => value === NONE)).toBe(true);
      const ordered = [...present].sort((x, y) => (direction === 'asc' ? x - y : y - x));
      expect(present).toEqual(ordered);
    }
    // The biggest slip comes first when sorted descending.
    const worst = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 1],
      columns: ['finishDelta'],
      sort: { column: 'finishDelta', direction: 'desc' },
    });
    expect(worst.numbers.finishDelta![0]).toBeGreaterThanOrEqual(expected.milestone.slipMinutes);
  });

  it('sorts by a text column', () => {
    const session = loaded();
    const rows = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 2000],
      columns: ['code'],
      sort: { column: 'code', direction: 'asc' },
    });
    const codes = rows.text.code!;
    expect(codes).toEqual([...codes].sort());
    const reversed = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 3],
      columns: ['code'],
      sort: { column: 'code', direction: 'desc' },
    });
    expect(reversed.text.code).toEqual(codes.slice(-3).reverse());
  });

  it('shows the previous update beside the current one, and nothing previous for added activities', () => {
    const session = loaded();
    const rows = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 5],
      columns: ['code', 'finish', 'previousFinish', 'finishDelta'],
      filter: { text: expected.milestone.code },
    });
    expect(rows.text.code).toEqual([expected.milestone.code]);
    expect(formatXerDate(rows.numbers.finish![0]!)).toBe(expected.milestone.finish02);
    expect(formatXerDate(rows.numbers.previousFinish![0]!)).toBe(expected.milestone.finish01);
    expect(rows.numbers.finishDelta![0]).toBe(expected.milestone.slipMinutes);

    const added = ask(session, {
      type: 'rows',
      slot: 'b',
      range: [0, 100],
      columns: ['previousFinish', 'finishDelta'],
      filter: { flagsAny: Change.Added },
    });
    expect(added.numbers.previousFinish!.every((value) => value === NONE)).toBe(true);
    expect(added.numbers.finishDelta!.every((value) => value === NONE)).toBe(true);
  });

  it('gives the same view again from its cache, and a fresh one after the schedule changes', () => {
    const session = loaded();
    const request: Extract<EngineRequest, { type: 'rows' }> = {
      type: 'rows',
      slot: 'b',
      range: [0, 50],
      columns: ['code'],
      filter: { changedOnly: true },
      sort: { column: 'finishDelta', direction: 'desc' },
    };
    const first = ask(session, request);
    const second = ask(session, request);
    expect(Array.from(second.indices)).toEqual(Array.from(first.indices));
    session.handle({ type: 'load', slot: 'a', data: parseXerText(textB) });
    // Update A is now the same file as update B, so nothing has changed.
    expect(ask(session, request).total).toBe(0);
  });

  it('works on update A alone, without comparison columns', () => {
    const session = new EngineSession();
    session.handle({ type: 'load', slot: 'a', data: parseXerText(textA) });
    const rows = ask(session, {
      type: 'rows',
      slot: 'a',
      range: [0, 3],
      columns: ['code', 'start', 'finishDelta', 'flags'],
    });
    expect(rows.text.code).toHaveLength(3);
    expect(rows.numbers.finishDelta!.every((value) => value === NONE)).toBe(true);
    expect(
      ask(session, {
        type: 'rows',
        slot: 'a',
        range: [0, 3],
        columns: ['code'],
        filter: { changedOnly: true },
      }).total,
    ).toBe(0);
  });

  it('rejects malformed requests with a clear code', () => {
    const session = loaded();
    const bad: unknown[] = [
      { type: 'rows', slot: 'b', range: [5, 2], columns: ['code'] },
      { type: 'rows', slot: 'b', range: [0, 10], columns: ['password'] },
      {
        type: 'rows',
        slot: 'b',
        range: [0, 10],
        columns: ['code'],
        sort: { column: 'nope', direction: 'asc' },
      },
      { type: 'rows', slot: 'c', range: [0, 10], columns: ['code'] },
      { type: 'launch' },
    ];
    for (const request of bad) {
      try {
        session.handle(request as EngineRequest);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(EngineError);
        expect(['bad-request', 'not-loaded']).toContain((error as EngineError).code);
      }
    }
  });

  it('lists only typed arrays for transfer', () => {
    const rows = ask(loaded(), {
      type: 'rows',
      slot: 'b',
      range: [0, 5],
      columns: ['code', 'finish', 'flags'],
    });
    expect(EngineSession.transferList(rows).length).toBe(3);
    expect(EngineSession.transferList({ type: 'ping' })).toEqual([]);
  });
});
