/** Checks the slip trace against the drivers the generator scripted (expected.json). */
import { describe, expect, it } from 'vitest';
import {
  TraceEnd,
  diffSchedules,
  prepareClocks,
  traceSlip,
  type DiffDates,
  type TraceResult,
} from '@slip/engine';
import { NONE, Status, parseXerText, stringAt, type ScheduleData } from '@slip/xer';
import { generatePair, xerText, type GenOptions } from '../src/index.ts';

const fileDates = (data: ScheduleData): DiffDates => ({
  earlyStart: data.earlyStart,
  earlyFinish: data.earlyFinish,
  totalFloat: data.totalFloatMin,
});

function setup(options: GenOptions) {
  const pair = generatePair(options);
  const a = parseXerText(xerText(pair.update01));
  const b = parseXerText(xerText(pair.update02));
  const clocksA = prepareClocks(a);
  const clocksB = prepareClocks(b);
  const diff = diffSchedules(a, b, clocksB);
  const code = (j: number) => stringAt(b.strings, b.taskCode[j]!);
  const index = new Map<string, number>();
  for (let j = 0; j < b.n; j++) index.set(code(j), j);
  const trace = (target: string, options = {}): TraceResult =>
    traceSlip(
      a,
      b,
      diff,
      clocksA,
      clocksB,
      fileDates(a),
      fileDates(b),
      index.get(target)!,
      options,
    );
  return { pair, a, b, diff, code, index, trace };
}

const CASES: GenOptions[] = [
  { activities: 1000, seed: 42, sector: 'rail' },
  { activities: 5000, seed: 11, sector: 'flood' },
  { activities: 20000, seed: 9, sector: 'highways' },
];

for (const options of CASES) {
  describe(`slip trace (${options.sector} ${options.activities}, seed ${options.seed})`, () => {
    const { pair, b, code, trace } = setup(options);
    const { expected } = pair;
    const result = trace(expected.milestone.code);

    it('reports the slip of the milestone it was asked about', () => {
      expect(code(result.target)).toBe(expected.milestone.code);
      expect(result.slipMinutes).toBe(expected.milestone.slipMinutes);
      expect(result.slipWorkingDays).toBe(expected.milestone.slipWorkingDays);
      expect(result.nodes[0]).toBe(result.target);
      expect(result.depth[0]).toBe(0);
    });

    it('finds every scripted driver on the driving network', () => {
      const onNetwork = new Set(Array.from(result.nodes, code));
      for (const driver of expected.drivers)
        expect(onNetwork.has(driver.code), driver.code).toBe(true);
    });

    it('ranks the scripted drivers as the largest contributors, with the scripted growth', () => {
      const top = result.contributors.slice(0, expected.drivers.length);
      expect(top.map((entry) => entry.kind)).toEqual(expected.drivers.map(() => 'duration'));
      expect(top.map((entry) => code(entry.activity)).sort()).toEqual(
        expected.drivers.map((d) => d.code).sort(),
      );
      for (const driver of expected.drivers) {
        const found = result.contributors.find(
          (entry) => code(entry.activity) === driver.code && entry.kind === 'duration',
        );
        expect(found?.minutes).toBe(driver.growthMinutes);
        expect(found?.workingDays).toBe(driver.growthWorkingDays);
      }
    });

    it('explains the slip: the contributions add up to it, give or take a calendar', () => {
      const total = result.contributors.reduce((sum, entry) => sum + entry.workingDays, 0);
      // Not exact: contributors sit on six and seven day calendars, and the network can branch.
      expect(Math.abs(total - expected.milestone.slipWorkingDays)).toBeLessThanOrEqual(
        Math.max(3, expected.milestone.slipWorkingDays * 0.15),
      );
    });

    it('only follows relationships that exist, from predecessor to successor', () => {
      const nodes = new Set(result.nodes);
      for (let e = 0; e < result.edgePred.length; e++) {
        const pred = result.edgePred[e]!;
        const succ = result.edgeSucc[e]!;
        expect(nodes.has(pred) && nodes.has(succ)).toBe(true);
        let exists = false;
        for (let k = b.predOffsets[succ]!; k < b.predOffsets[succ + 1]!; k++)
          if (b.predTargets[k] === pred) exists = true;
        expect(exists).toBe(true);
      }
      expect(result.edgePred.length).toBeGreaterThanOrEqual(result.nodes.length - 1);
    });

    it('stops at finished work or the data date, and says which', () => {
      for (let at = 0; at < result.nodes.length; at++) {
        const j = result.nodes[at]!;
        if (result.end[at] === TraceEnd.Complete) expect(b.status[j]).toBe(Status.Complete);
        if (result.end[at] === TraceEnd.Driven) expect(b.status[j]).not.toBe(Status.Complete);
      }
      expect(Array.from(result.end).some((end) => end !== TraceEnd.Driven)).toBe(true);
      expect(result.truncated).toBe(false);
    });
  });
}

describe('slip trace limits and edge cases', () => {
  const { pair, b, diff, code, index, trace } = setup({
    activities: 1000,
    seed: 42,
    sector: 'rail',
  });

  it('respects the size limit and says it was cut short', () => {
    const small = trace(pair.expected.milestone.code, { maxNodes: 5 });
    expect(small.nodes.length).toBe(5);
    expect(small.truncated).toBe(true);
    const shallow = trace(pair.expected.milestone.code, { maxDepth: 2 });
    expect(Math.max(...shallow.depth)).toBeLessThanOrEqual(2);
    expect(shallow.truncated).toBe(true);
    expect(Array.from(shallow.end)).toContain(TraceEnd.Limit);
  });

  it('caps the contributor list', () => {
    expect(trace(pair.expected.milestone.code, { maxContributors: 2 }).contributors.length).toBe(2);
  });

  it('traces a finished activity to itself', () => {
    let done = -1;
    for (let j = 0; j < b.n && done < 0; j++) if (b.status[j] === Status.Complete) done = j;
    const result = trace(code(done));
    expect(Array.from(result.nodes)).toEqual([done]);
    expect(result.end[0]).toBe(TraceEnd.Complete);
    expect(result.contributors).toEqual([]);
  });

  it('traces an added activity without a previous finish to compare', () => {
    const added = pair.expected.changes.added[0]!;
    const result = trace(added);
    expect(result.slipMinutes).toBe(NONE);
    expect(result.slipWorkingDays).toBe(0);
    expect(
      result.contributors.some(
        (entry) => entry.kind === 'added' && entry.activity === index.get(added),
      ),
    ).toBe(true);
    expect(diff.matchA[index.get(added)!]).toBe(-1);
  });

  it('gives an activity that did not move no positive contributors of its own', () => {
    // The first milestone is long finished in both updates.
    const result = trace('MS-START');
    expect(result.slipMinutes).toBe(0);
    expect(result.contributors).toEqual([]);
  });
});
