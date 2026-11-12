import { describe, expect, it } from 'vitest';
import { parseXerText } from '@slip/xer';
import { buildXer } from '../../xer/test/fixture.ts';
import { EngineSession } from '../src/index.ts';

// A fresh copy each time: loading hands the schedule to the session.
const read = () => parseXerText(buildXer());

function finishes(session: EngineSession): number[] {
  const rows = session.handle({
    type: 'rows',
    slot: 'b',
    range: [0, 50],
    columns: ['finish'],
    sort: { column: 'code', direction: 'asc' },
  });
  if (rows.type !== 'rows') throw new Error('expected rows');
  return [...rows.numbers.finish!];
}

describe('cpm preview', () => {
  it('reports the recalculation without changing what views show', () => {
    const session = new EngineSession();
    session.handle({ type: 'load', slot: 'a', data: read() });
    session.handle({ type: 'load', slot: 'b', data: read() });

    const before = finishes(session);
    const diffBefore = session.handle({ type: 'diff' });
    const preview = session.handle({ type: 'cpm', slot: 'b', preview: true });
    expect(preview.type).toBe('cpm');
    if (preview.type !== 'cpm') return;
    expect(preview.differsFromFile).toBeGreaterThanOrEqual(0);

    expect(finishes(session)).toEqual(before);
    expect(session.handle({ type: 'diff' })).toEqual(diffBefore);
  });

  it('gives the same summary as a kept recalculation', () => {
    const preview = new EngineSession();
    preview.handle({ type: 'load', slot: 'b', data: read() });
    const kept = new EngineSession();
    kept.handle({ type: 'load', slot: 'b', data: read() });
    expect(preview.handle({ type: 'cpm', slot: 'b', preview: true })).toEqual(
      kept.handle({ type: 'cpm', slot: 'b' }),
    );
  });

  it('treats anything but true as a kept recalculation', () => {
    const session = new EngineSession();
    session.handle({ type: 'load', slot: 'b', data: read() });
    const request = { type: 'cpm', slot: 'b', preview: 'yes' } as unknown as Parameters<
      EngineSession['handle']
    >[0];
    expect(session.handle(request).type).toBe('cpm');
  });
});

describe('locate', () => {
  const session = new EngineSession();
  session.handle({ type: 'load', slot: 'b', data: read() });
  const view = { sort: { column: 'code', direction: 'desc' } } as const;
  const rows = session.handle({ type: 'rows', slot: 'b', range: [0, 50], columns: [], ...view });
  if (rows.type !== 'rows') throw new Error('expected rows');

  it('finds the row of an activity in a sorted view', () => {
    for (const row of [0, rows.indices.length - 1]) {
      const found = session.handle({
        type: 'locate',
        slot: 'b',
        activity: rows.indices[row]!,
        ...view,
      });
      expect(found).toMatchObject({ type: 'locate', row, total: rows.total });
    }
  });

  it('answers -1 when the filter leaves the activity out', () => {
    const found = session.handle({
      type: 'locate',
      slot: 'b',
      activity: rows.indices[0]!,
      filter: { text: 'no activity has this text in it' },
    });
    expect(found).toMatchObject({ row: -1, total: 0 });
  });

  it('rejects an activity that does not exist', () => {
    for (const activity of [-1, 1.5, 1e9, Number.NaN]) {
      expect(() => session.handle({ type: 'locate', slot: 'b', activity })).toThrow(
        'There is no such activity.',
      );
    }
  });
});

describe('trace', () => {
  it('gives the finish slip of every activity on the path, in working days', () => {
    const session = new EngineSession();
    session.handle({ type: 'load', slot: 'a', data: read() });
    session.handle({ type: 'load', slot: 'b', data: read() });
    const trace = session.handle({ type: 'trace', activity: 0 });
    if (trace.type !== 'trace') throw new Error('expected a trace');
    expect(trace.slipDays).toHaveLength(trace.nodes.length);
    expect(trace.codes).toHaveLength(trace.nodes.length);
    // The two updates are the same file, so nothing moved.
    expect(trace.slipDays.every((days) => days === 0 || days === null)).toBe(true);
    expect(trace.slipWorkingDays).toBe(0);
  });
});
