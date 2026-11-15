import { describe, expect, it } from 'vitest';
import { parseXerText, RelType } from '@slip/xer';
import { buildXer, row } from '../../xer/test/fixture.ts';
import { EngineSession, type LogicLink } from '../src/index.ts';

// Task ids 101 MS-START, 102 A1000, 103 A1010, 104 MS-END.
const A_RELS = [
  row('%R', 1, 102, 101, 1, 1, 'PR_FS', 0),
  row('%R', 2, 103, 102, 1, 1, 'PR_SS', 16),
  row('%R', 3, 104, 103, 1, 1, 'PR_FF', -8),
  row('%R', 4, 104, 102, 1, 1, 'PR_FS', 0),
];
// Update B: A1000 to MS-END is removed, MS-START to MS-END is added.
const B_RELS = [
  row('%R', 1, 102, 101, 1, 1, 'PR_FS', 0),
  row('%R', 2, 103, 102, 1, 1, 'PR_SS', 16),
  row('%R', 3, 104, 103, 1, 1, 'PR_FF', -8),
  row('%R', 5, 104, 101, 1, 1, 'PR_FS', 0),
];

function session(withA = true) {
  const s = new EngineSession();
  if (withA) s.handle({ type: 'load', slot: 'a', data: parseXerText(buildXer({ rels: A_RELS })) });
  s.handle({ type: 'load', slot: 'b', data: parseXerText(buildXer({ rels: B_RELS })) });
  return s;
}

function indexOf(s: EngineSession, code: string): number {
  const found = s.handle({ type: 'activity', taskCode: code });
  if (found.type !== 'activity' || !found.current) throw new Error(`no ${code}`);
  return found.current.index;
}

function logic(s: EngineSession, code: string, filter = {}) {
  const result = s.handle({
    type: 'logic',
    activity: indexOf(s, code),
    filter,
    sort: { column: 'code', direction: 'asc' },
  });
  if (result.type !== 'logic') throw new Error('expected logic');
  return result;
}

const codesOf = (s: EngineSession) => {
  const r = s.handle({
    type: 'rows',
    slot: 'b',
    range: [0, 10],
    columns: ['code'],
    sort: { column: 'code', direction: 'asc' },
  });
  if (r.type !== 'rows') throw new Error('rows');
  return r.text.code!;
};

const describeLink = (s: EngineSession, link: LogicLink) => {
  const codes = codesOf(s);
  return `${codes[link.predRow] ?? '?'} > ${codes[link.succRow] ?? '?'} ${link.state}`;
};

describe('the logic around one activity', () => {
  it('marks links added and removed since update A, with rows in the view', () => {
    const s = session();
    const result = logic(s, 'MS-END');
    const direct = result.links.filter((link) => link.succ === result.activity);
    expect(direct.map((link) => describeLink(s, link)).sort()).toEqual([
      'A1000 > MS-END removed',
      'A1010 > MS-END kept',
      'MS-START > MS-END added',
    ]);
    expect(direct.find((link) => link.state === 'removed')?.relType).toBe(RelType.FS);
    expect(result.row).toBe(codesOf(s).indexOf('MS-END'));
    expect(result.removedGone).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('gives -1 for an end the view does not hold', () => {
    const s = session();
    const result = logic(s, 'MS-END', { text: 'MS-' });
    const fromA1010 = result.links.find((link) => link.relType === RelType.FF)!;
    expect(fromA1010.predRow).toBe(-1);
    expect(fromA1010.succRow).toBe(result.row);
  });

  it('calls every link kept when there is no update A to compare with', () => {
    const s = session(false);
    const result = logic(s, 'MS-END');
    expect(result.links.every((link) => link.state === 'kept' && !link.driving)).toBe(true);
    expect(result.links).toHaveLength(2);
  });

  it('refuses an activity that does not exist', () => {
    const s = session();
    for (const activity of [-1, 99, 1.5, Number.NaN]) {
      expect(() => s.handle({ type: 'logic', activity })).toThrow(/no such activity/);
    }
  });
});
