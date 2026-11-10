import { describe, expect, it } from 'vitest';
import { compileCalendar, snapForward, workBetween, type WorkClock } from '@slip/engine';
import {
  NONE,
  RelType,
  Status,
  TaskType,
  formatXerDate,
  parseCalendar,
  parseXerDate,
  parseXerText,
  stringAt,
  type ScheduleData,
} from '@slip/xer';
import { calendarData, generatePair, xerText, SECTORS } from '../src/index.ts';

const OPTIONS = { activities: 1000, seed: 42, sector: 'rail' } as const;
const pair = generatePair(OPTIONS);
const text1 = xerText(pair.update01);
const text2 = xerText(pair.update02);
const data1 = parseXerText(text1);
const data2 = parseXerText(text2);
const { expected } = pair;

const code = (data: ScheduleData, i: number) => stringAt(data.strings, data.taskCode[i]!);
function indexByCode(data: ScheduleData): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < data.n; i++) map.set(code(data, i), i);
  return map;
}
const byCode1 = indexByCode(data1);
const byCode2 = indexByCode(data2);

function clocksFor(data: ScheduleData): WorkClock[] {
  const day = Math.floor(parseXerDate('2026-01-05') / 1440);
  return data.calendars.calendars.map((calendar) =>
    compileCalendar(calendar, day - 2000, day + 30000),
  );
}

describe('generated pair', () => {
  it('is the same every time for the same options', () => {
    const again = generatePair(OPTIONS);
    expect(xerText(again.update01)).toBe(text1);
    expect(xerText(again.update02)).toBe(text2);
    expect(again.expected).toEqual(expected);
  });

  it('changes with the seed', () => {
    expect(xerText(generatePair({ ...OPTIONS, seed: 43 }).update01)).not.toBe(text1);
  });

  it('parses cleanly, with the counts it promised', () => {
    expect(data1.meta.warnings).toEqual([]);
    expect(data2.meta.warnings).toEqual([]);
    expect(data1.n).toBe(1000);
    expect(data1.n).toBe(expected.update01.activities);
    expect(data2.n).toBe(expected.update02.activities);
    expect(data1.meta.relationshipCount).toBe(expected.update01.relationships);
    expect(data2.meta.relationshipCount).toBe(expected.update02.relationships);
    expect(formatXerDate(data1.meta.dataDate)).toBe(expected.update01.dataDate);
    expect(formatXerDate(data2.meta.dataDate)).toBe(expected.update02.dataDate);
    expect(data2.meta.dataDate - data1.meta.dataDate).toBe(28 * 1440);
  });

  it('has unique activity codes and a WBS four levels deep', () => {
    expect(byCode1.size).toBe(data1.n);
    expect(byCode2.size).toBe(data2.n);
    let deepest = 0;
    for (let w = 0; w < data1.wbs.n; w++) {
      let depth = 0;
      for (let node = w; node >= 0; node = data1.wbs.parent[node]!) depth++;
      deepest = Math.max(deepest, depth);
    }
    expect(deepest).toBe(4);
  });

  it('writes calendars that read back identically', () => {
    for (const calendar of pair.update01.net.calendars) {
      const back = parseCalendar(
        calendar.id,
        calendar.name,
        calendar.dayMinutes,
        calendarData(calendar),
      );
      expect(back).toEqual(calendar);
    }
    expect(data1.calendars.calendars.every((calendar) => calendar.parsed)).toBe(true);
  });

  it('uses different task ids in the two updates, so matching must go by code', () => {
    const id = (text: string, taskCode: string) =>
      text
        .split('\r\n')
        .find((line) => line.includes(`\t${taskCode}\t`))!
        .split('\t')[1];
    expect(id(text1, 'MS-COMPLETE')).not.toBe(id(text2, 'MS-COMPLETE'));
  });

  it('looks like a real schedule: mostly FS, a mix of statuses, some constraints', () => {
    const types = [0, 0, 0, 0, 0];
    for (const type of data1.predType) types[type]!++;
    expect(types[RelType.FS]! / data1.meta.relationshipCount).toBeGreaterThan(0.85);
    expect(types[RelType.SS]).toBeGreaterThan(0);
    expect(types[RelType.FF]).toBeGreaterThan(0);
    const statuses = [0, 0, 0, 0];
    for (const status of data1.status) statuses[status]!++;
    expect(statuses[Status.Complete]).toBeGreaterThan(50);
    expect(statuses[Status.Active]).toBeGreaterThan(0);
    expect(statuses[Status.NotStarted]).toBeGreaterThan(300);
    expect(data1.constraintType.filter((type) => type !== 0).length).toBeGreaterThan(3);
    expect(new Set(data1.calendarIndex).size).toBe(3);
  });
});

describe('schedule dates', () => {
  for (const [label, data] of [
    ['update 01', data1],
    ['update 02', data2],
  ] as const) {
    it(`${label}: every relationship is honoured and nothing is planned before the data date`, () => {
      const clocks = clocksFor(data);
      const shift = (clock: WorkClock, t: number, lag: number) =>
        lag === 0 ? t : moveBy(clock, t, lag);
      let checked = 0;
      for (let i = 0; i < data.n; i++) {
        if (data.status[i] === Status.Complete) {
          expect(data.actualFinish[i]).not.toBe(NONE);
          expect(data.actualFinish[i]).toBeLessThanOrEqual(data.meta.dataDate);
          expect(data.totalFloatMin[i]).toBe(NONE);
          continue;
        }
        expect(data.earlyFinish[i]).toBeGreaterThanOrEqual(data.meta.dataDate);
        expect(data.earlyFinish[i]).toBeGreaterThanOrEqual(data.earlyStart[i]!);
        const own = clocks[data.calendarIndex[i]!]!;
        expect(data.totalFloatMin[i]).toBe(
          workBetween(own, data.earlyFinish[i]!, data.lateFinish[i]!),
        );
        if (data.status[i] === Status.NotStarted) {
          expect(data.earlyStart[i]).toBeGreaterThanOrEqual(data.meta.dataDate);
          if (data.type[i] === TaskType.Task) {
            expect(workBetween(own, data.earlyStart[i]!, data.earlyFinish[i]!)).toBe(
              data.remainingDurationMin[i],
            );
          }
        }
        for (let k = data.predOffsets[i]!; k < data.predOffsets[i + 1]!; k++) {
          const pred = data.predTargets[k]!;
          const clock = clocks[data.calendarIndex[pred]!]!;
          const type = data.predType[k]!;
          const from =
            type === RelType.FS || type === RelType.FF
              ? data.earlyFinish[pred]!
              : data.earlyStart[pred]!;
          const bound = shift(clock, from, data.predLagMin[k]!);
          const mine =
            type === RelType.FS || type === RelType.SS ? data.earlyStart[i]! : data.earlyFinish[i]!;
          // An activity already under way keeps its actual start whatever its predecessors say.
          if (data.status[i] === Status.Active && (type === RelType.FS || type === RelType.SS))
            continue;
          expect(mine, `${code(data, pred)} -> ${code(data, i)}`).toBeGreaterThanOrEqual(bound);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(500);
    });
  }

  it('update 01 is exactly on plan: early dates equal the planned dates', () => {
    for (let i = 0; i < data1.n; i++) {
      if (data1.status[i] === Status.NotStarted) {
        expect(data1.earlyStart[i]).toBe(data1.targetStart[i]);
      }
      expect(data1.earlyFinish[i]).toBe(data1.targetFinish[i]);
    }
  });

  it('starts work at the start of a working period', () => {
    const clocks = clocksFor(data2);
    for (let i = 0; i < data2.n; i++) {
      if (data2.status[i] !== Status.NotStarted || data2.type[i] !== TaskType.Task) continue;
      const own = clocks[data2.calendarIndex[i]!]!;
      expect(snapForward(own, data2.earlyStart[i]!)).toBe(data2.earlyStart[i]);
    }
  });
});

function moveBy(clock: WorkClock, t: number, lag: number): number {
  // Find the moment `lag` working minutes from t by searching outward a minute at a time.
  let result = t;
  const step = lag > 0 ? 1 : -1;
  while (workBetween(clock, t, result) !== lag) result += step;
  if (lag < 0) while (workBetween(clock, t, result - 1) === lag) result -= 1;
  return result;
}

describe('expected.json', () => {
  it('records a slip on the completion milestone that matches the files', () => {
    const { milestone } = expected;
    expect(milestone.code).toBe('MS-COMPLETE');
    expect(formatXerDate(data1.earlyFinish[byCode1.get(milestone.code)!]!)).toBe(
      milestone.finish01,
    );
    expect(formatXerDate(data2.earlyFinish[byCode2.get(milestone.code)!]!)).toBe(
      milestone.finish02,
    );
    expect(milestone.slipWorkingDays).toBeGreaterThan(0);
  });

  it('explains the slip: it is close to the growth scripted on the driving chain', () => {
    expect(expected.drivers.length).toBeGreaterThanOrEqual(3);
    const growth = expected.drivers.reduce((total, driver) => total + driver.growthWorkingDays, 0);
    // Not exactly equal: drivers can sit on a six day calendar while the milestone counts five day
    // weeks, and a longer chain can cross a holiday that the shorter one did not.
    expect(Math.abs(expected.milestone.slipWorkingDays - growth)).toBeLessThanOrEqual(
      Math.max(2, growth * 0.1),
    );
    for (const driver of expected.drivers) {
      const before = data1.originalDurationMin[byCode1.get(driver.code)!]!;
      const after = data2.originalDurationMin[byCode2.get(driver.code)!]!;
      expect(after - before).toBe(driver.growthMinutes);
    }
  });

  it('lists added and removed activities that the files agree with', () => {
    const { added, removed } = expected.changes;
    expect(added.length).toBeGreaterThan(0);
    expect(removed.length).toBeGreaterThan(0);
    for (const taskCode of added) {
      expect(byCode1.has(taskCode)).toBe(false);
      expect(byCode2.has(taskCode)).toBe(true);
    }
    for (const taskCode of removed) {
      expect(byCode1.has(taskCode)).toBe(true);
      expect(byCode2.has(taskCode)).toBe(false);
    }
    const inBoth = [...byCode1.keys()].filter((taskCode) => byCode2.has(taskCode)).length;
    expect(inBoth).toBe(data1.n - removed.length);
    expect(data2.n).toBe(inBoth + added.length);
  });

  it('lists every duration change and no others', () => {
    const changed: string[] = [];
    for (const [taskCode, i] of byCode1) {
      const j = byCode2.get(taskCode);
      if (j !== undefined && data1.originalDurationMin[i] !== data2.originalDurationMin[j])
        changed.push(taskCode);
    }
    expect(changed.sort()).toEqual([...expected.changes.durationChanged].sort());
  });

  it('lists every logic change and no others', () => {
    const relationships = (data: ScheduleData) => {
      const map = new Map<string, number>();
      for (let i = 0; i < data.n; i++) {
        for (let k = data.predOffsets[i]!; k < data.predOffsets[i + 1]!; k++) {
          const name = ['', 'FS', 'SS', 'FF', 'SF'][data.predType[k]!];
          map.set(
            `${code(data, data.predTargets[k]!)}>${code(data, i)}>${name}`,
            data.predLagMin[k]!,
          );
        }
      }
      return map;
    };
    const gone = new Set(expected.changes.removed);
    const fresh = new Set(expected.changes.added);
    const before = relationships(data1);
    const after = relationships(data2);
    const key = (entry: [string, string, string]) => entry.join('>');
    const addedKeys = [...after.keys()].filter(
      (k) => !before.has(k) && !fresh.has(k.split('>')[1]!),
    );
    const removedKeys = [...before.keys()].filter(
      (k) => !after.has(k) && !gone.has(k.split('>')[0]!) && !gone.has(k.split('>')[1]!),
    );
    const lagKeys = [...before.keys()].filter(
      (k) => after.has(k) && after.get(k) !== before.get(k),
    );
    expect(addedKeys.sort()).toEqual(expected.changes.relationshipAdded.map(key).sort());
    expect(removedKeys.sort()).toEqual(expected.changes.relationshipRemoved.map(key).sort());
    expect(lagKeys.sort()).toEqual(expected.changes.lagChanged.map(key).sort());
  });

  it('lists every new constraint', () => {
    for (const taskCode of expected.changes.constraintAdded) {
      expect(data1.constraintType[byCode1.get(taskCode)!]).toBe(0);
      expect(data2.constraintType[byCode2.get(taskCode)!]).not.toBe(0);
    }
  });
});

describe('other sizes and sectors', () => {
  it('works for every sector and for small and awkward sizes', () => {
    for (const sector of SECTORS) {
      for (const activities of [10, 37, 250]) {
        const small = generatePair({ activities, seed: 7, sector });
        const parsed = parseXerText(xerText(small.update01));
        expect(parsed.n).toBe(activities);
        expect(parsed.meta.warnings).toEqual([]);
        expect(parseXerText(xerText(small.update02)).meta.warnings).toEqual([]);
      }
    }
  });

  it('refuses a schedule too small to be one', () => {
    expect(() => generatePair({ activities: 5, seed: 1, sector: 'rail' })).toThrowError(RangeError);
  });
});
