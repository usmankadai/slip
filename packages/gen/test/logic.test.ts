import { describe, expect, it } from 'vitest';
import { EngineSession, type EngineRequest, type EngineResult } from '@slip/engine';
import { parseXerText } from '@slip/xer';
import { generatePair, xerText } from '../src/index.ts';

const pair = generatePair({ activities: 1000, seed: 42, sector: 'rail' });
const session = new EngineSession();
session.handle({ type: 'load', slot: 'a', data: parseXerText(xerText(pair.update01)) });
session.handle({ type: 'load', slot: 'b', data: parseXerText(xerText(pair.update02)) });

function ask<T extends EngineRequest['type']>(request: Extract<EngineRequest, { type: T }>) {
  return session.handle(request) as Extract<EngineResult, { type: T }>;
}

describe('the logic around the slipped milestone', () => {
  const code = pair.expected.milestone.code;
  const target = ask({ type: 'activity', taskCode: code }).current!.index;
  const sort = { column: 'finishDelta' as const, direction: 'desc' as const };
  const logic = ask({ type: 'logic', activity: target, sort });
  const trace = ask({ type: 'trace', activity: target });

  it('draws the same driving path the trace walks', () => {
    const driving = logic.links.filter((link) => link.driving);
    const edges = new Set(Array.from(trace.edgePred, (pred, k) => `${pred}>${trace.edgeSucc[k]}`));
    expect(driving.length).toBe(edges.size);
    for (const link of driving) expect(edges.has(`${link.pred}>${link.succ}`)).toBe(true);
    expect(driving.some((link) => link.succ === target)).toBe(true);
  });

  it('includes every activity the generator says drove the slip', () => {
    const onPath = new Set(logic.links.filter((l) => l.driving).flatMap((l) => [l.pred, l.succ]));
    for (const driver of pair.expected.drivers) {
      const index = ask({ type: 'activity', taskCode: driver.code }).current!.index;
      expect(onPath.has(index)).toBe(true);
    }
  });

  it('gives each end its row in the sorted view', () => {
    for (const link of logic.links.slice(0, 20)) {
      for (const [activity, row] of [
        [link.pred, link.predRow],
        [link.succ, link.succRow],
      ] as const) {
        const found = ask({ type: 'locate', slot: 'b', activity, sort });
        expect(row).toBe(found.row);
      }
    }
  });
});
