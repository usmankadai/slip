/**
 * Holds the engine's CPM to the generator's own scheduler. The two were
 * written separately and share only the calendar arithmetic, so agreement
 * on every date and float value, at several sizes, seeds and sectors, is a
 * real check that both follow the conventions in decision D17.
 */
import { describe, expect, it } from 'vitest';
import { runCpm } from '@slip/engine';
import { formatXerDate, parseXerText, stringAt, type ScheduleData } from '@slip/xer';
import { generatePair, xerText, type GenOptions } from '../src/index.ts';

const CASES: GenOptions[] = [
  { activities: 1000, seed: 42, sector: 'rail' },
  { activities: 2500, seed: 7, sector: 'flood' },
  { activities: 400, seed: 1234, sector: 'solar' },
  { activities: 10000, seed: 3, sector: 'highways' },
];

function firstDifference(
  data: ScheduleData,
  name: string,
  ours: Int32Array,
  stored: Int32Array,
): string | null {
  for (let i = 0; i < data.n; i++) {
    if (ours[i] !== stored[i]) {
      const code = stringAt(data.strings, data.taskCode[i]!);
      const show = name.includes('Float') ? String : formatXerDate;
      return `${name} of ${code}: engine ${show(ours[i]!)}, file ${show(stored[i]!)}`;
    }
  }
  return null;
}

describe('engine CPM against the generator', () => {
  for (const options of CASES) {
    const pair = generatePair(options);
    for (const [label, update] of [
      ['update 01', pair.update01],
      ['update 02', pair.update02],
    ] as const) {
      it(`${options.sector} ${options.activities}, seed ${options.seed}, ${label}: every date and float matches`, () => {
        const data = parseXerText(xerText(update));
        const cpm = runCpm(data);
        expect(cpm.loopActivities.length).toBe(0);
        expect(firstDifference(data, 'earlyStart', cpm.earlyStart, data.earlyStart)).toBeNull();
        expect(firstDifference(data, 'earlyFinish', cpm.earlyFinish, data.earlyFinish)).toBeNull();
        expect(firstDifference(data, 'lateStart', cpm.lateStart, data.lateStart)).toBeNull();
        expect(firstDifference(data, 'lateFinish', cpm.lateFinish, data.lateFinish)).toBeNull();
        expect(firstDifference(data, 'totalFloat', cpm.totalFloat, data.totalFloatMin)).toBeNull();
        expect(firstDifference(data, 'freeFloat', cpm.freeFloat, data.freeFloatMin)).toBeNull();
      });
    }
  }

  it('finds the same completion date the generator recorded', () => {
    const pair = generatePair(CASES[0]!);
    const data = parseXerText(xerText(pair.update02));
    const cpm = runCpm(data);
    let completion = -1;
    for (let i = 0; i < data.n; i++)
      if (stringAt(data.strings, data.taskCode[i]!) === 'MS-COMPLETE') completion = i;
    expect(formatXerDate(cpm.earlyFinish[completion]!)).toBe(pair.expected.milestone.finish02);
    expect(cpm.projectFinish).toBeGreaterThanOrEqual(cpm.earlyFinish[completion]!);
  });
});
