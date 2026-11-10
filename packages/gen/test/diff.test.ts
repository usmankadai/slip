/**
 * Checks the engine's diff against what the generator says it changed
 * between update 01 and update 02 (expected.json).
 */
import { describe, expect, it } from 'vitest';
import { Change, diffSchedules, prepareClocks, runCpm } from '@slip/engine';
import { NONE, parseXerText, stringAt, type ScheduleData } from '@slip/xer';
import { generatePair, xerText } from '../src/index.ts';

const CASES = [
  { activities: 1000, seed: 42, sector: 'rail' },
  { activities: 5000, seed: 11, sector: 'flood' },
] as const;

for (const options of CASES) {
  describe(`diff of a generated pair (${options.sector} ${options.activities}, seed ${options.seed})`, () => {
    const pair = generatePair(options);
    const a = parseXerText(xerText(pair.update01));
    const b = parseXerText(xerText(pair.update02));
    const diff = diffSchedules(a, b, prepareClocks(b));
    const { expected } = pair;
    const codeA = (i: number) => stringAt(a.strings, a.taskCode[i]!);
    const codeB = (j: number) => stringAt(b.strings, b.taskCode[j]!);
    const withFlag = (flag: number) => {
      const codes: string[] = [];
      for (let j = 0; j < b.n; j++) if (diff.flags[j]! & flag) codes.push(codeB(j));
      return codes.sort();
    };
    const indexB = new Map<string, number>();
    for (let j = 0; j < b.n; j++) indexB.set(codeB(j), j);
    const sorted = (codes: string[]) => [...codes].sort();

    it('finds exactly the added and removed activities', () => {
      expect(withFlag(Change.Added)).toEqual(sorted(expected.changes.added));
      expect(sorted(Array.from(diff.removed, codeA))).toEqual(sorted(expected.changes.removed));
      expect(diff.counts.Added).toBe(expected.changes.added.length);
      expect(diff.counts.Removed).toBe(expected.changes.removed.length);
      expect(diff.counts.DuplicateCode).toBe(0);
    });

    it('matches every other activity by code, although the task ids differ', () => {
      for (let j = 0; j < b.n; j++) {
        const i = diff.matchA[j]!;
        if (i >= 0) {
          expect(codeA(i)).toBe(codeB(j));
          expect(diff.matchB[i]).toBe(j);
        }
      }
      expect(diff.matchA.filter((i) => i >= 0).length).toBe(a.n - expected.changes.removed.length);
    });

    it('finds exactly the duration changes, with the scripted growth on the drivers', () => {
      expect(withFlag(Change.DurationChanged)).toEqual(sorted(expected.changes.durationChanged));
      for (const driver of expected.drivers) {
        expect(diff.durationDelta[indexB.get(driver.code)!]).toBe(driver.growthMinutes);
      }
    });

    it('finds exactly the new constraints', () => {
      expect(withFlag(Change.ConstraintChanged)).toEqual(sorted(expected.changes.constraintAdded));
    });

    it('counts relationship changes and flags the activities at both ends', () => {
      const { relationshipAdded, relationshipRemoved, lagChanged, added, removed } =
        expected.changes;
      const gone = new Set(removed);
      // Relationships that touch an added or removed activity come and go with it.
      let withAdded = 0;
      const ends = new Set<string>();
      for (const code of added) {
        const j = indexB.get(code)!;
        for (let k = b.predOffsets[j]!; k < b.predOffsets[j + 1]!; k++) {
          withAdded++;
          ends.add(codeB(b.predTargets[k]!));
        }
        for (let k = b.succOffsets[j]!; k < b.succOffsets[j + 1]!; k++) {
          withAdded++;
          ends.add(codeB(b.succTargets[k]!));
        }
      }
      let withRemoved = 0;
      for (let i = 0; i < a.n; i++) {
        for (let k = a.predOffsets[i]!; k < a.predOffsets[i + 1]!; k++) {
          const pred = codeA(a.predTargets[k]!);
          if (!gone.has(codeA(i)) && !gone.has(pred)) continue;
          withRemoved++;
          if (!gone.has(codeA(i))) ends.add(codeA(i));
          if (!gone.has(pred)) ends.add(pred);
        }
      }
      expect(diff.relationships.added).toBe(relationshipAdded.length + withAdded);
      expect(diff.relationships.removed).toBe(relationshipRemoved.length + withRemoved);
      expect(diff.relationships.lagChanged).toBe(lagChanged.length);

      for (const [pred, succ] of [...relationshipAdded, ...relationshipRemoved, ...lagChanged]) {
        if (!gone.has(pred)) ends.add(pred);
        if (!gone.has(succ)) ends.add(succ);
      }
      for (const code of added) ends.delete(code);
      expect(withFlag(Change.LogicChanged)).toEqual(sorted([...ends]));
    });

    it('reports the completion slip in working minutes', () => {
      const j = indexB.get(expected.milestone.code)!;
      expect(diff.finishDelta[j]).toBe(expected.milestone.slipMinutes);
      expect(diff.flags[j]! & Change.FinishMoved).toBeTruthy();
    });

    it('flags progress on activities whose status or actual dates changed, and only those', () => {
      for (let j = 0; j < b.n; j++) {
        const i = diff.matchA[j]!;
        if (i < 0) continue;
        const moved =
          a.status[i] !== b.status[j] ||
          a.actualStart[i] !== b.actualStart[j] ||
          a.actualFinish[i] !== b.actualFinish[j];
        if (moved) expect(diff.flags[j]! & Change.Progressed, codeB(j)).toBeTruthy();
      }
      expect(diff.counts.Progressed).toBeGreaterThan(0);
      expect(diff.counts.Progressed).toBeLessThan(b.n / 2);
    });

    it('keeps its totals consistent', () => {
      let changed = 0;
      for (let j = 0; j < b.n; j++) if (diff.flags[j] !== 0) changed++;
      expect(diff.changed).toBe(changed);
      expect(diff.changed).toBeLessThan(b.n);
      // Unchanged activities have zero deltas, not missing ones.
      for (let j = 0; j < b.n; j++) {
        if (diff.flags[j] === 0 && diff.finishDelta[j] !== NONE)
          expect(diff.finishDelta[j]).toBe(0);
      }
    });

    it('gives the same answer from recalculated dates as from the dates in the files', () => {
      const cpmA = runCpm(a);
      const cpmB = runCpm(b);
      const again = diffSchedules(a, b, prepareClocks(b), cpmA, cpmB);
      expect(again.flags).toEqual(diff.flags);
      expect(again.finishDelta).toEqual(diff.finishDelta);
      expect(again.floatDelta).toEqual(diff.floatDelta);
    });
  });
}

describe('diff edge cases', () => {
  const pair = generatePair({ activities: 300, seed: 5, sector: 'solar' });
  const text = xerText(pair.update01);
  const data = (): ScheduleData => parseXerText(text);

  it('reports nothing when a schedule is compared with itself', () => {
    const diff = diffSchedules(data(), data(), prepareClocks(data()));
    expect(diff.changed).toBe(0);
    expect(diff.removed.length).toBe(0);
    expect(diff.relationships).toEqual({ added: 0, removed: 0, lagChanged: 0 });
  });

  it('treats two unrelated schedules as all removed and all added', () => {
    const other = parseXerText(
      text.replaceAll('P01-', 'Q01-').replaceAll('P02-', 'Q02-').replaceAll('MS-', 'KD-'),
    );
    const diff = diffSchedules(data(), other, prepareClocks(other));
    expect(diff.counts.Added).toBe(other.n);
    expect(diff.removed.length).toBe(300);
  });

  it('leaves later duplicates of a code out of matching without calling them added or removed', () => {
    const lines = text.split('\r\n');
    const taskLine = lines.find(
      (line) => line.startsWith('%R') && line.includes('\tMS-COMPLETE\t'),
    )!;
    const duplicate = taskLine.replace(/^%R\t\d+/, '%R\t999999999');
    const at = lines.indexOf(taskLine);
    const doubled = parseXerText(
      [...lines.slice(0, at + 1), duplicate, ...lines.slice(at + 1)].join('\r\n'),
    );
    expect(doubled.n).toBe(301);

    const asCurrent = diffSchedules(data(), doubled, prepareClocks(doubled));
    expect(asCurrent.counts.DuplicateCode).toBe(1);
    expect(asCurrent.counts.Added).toBe(0);
    expect(asCurrent.removed.length).toBe(0);

    const asPrevious = diffSchedules(doubled, data(), prepareClocks(data()));
    expect(asPrevious.removed.length).toBe(0);
    expect(asPrevious.counts.Added).toBe(0);
  });
});
