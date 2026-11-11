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
