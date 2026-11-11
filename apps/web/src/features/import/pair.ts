/** The "do these two belong together" check, from small facts about each update. No schedule data. */
import { apart, count, longDate, plural } from './format.ts';

export interface PairFacts {
  projectName: string;
  dataDate: number;
  sourceHash: string;
  activities: number;
}

export type PairKind = 'sound' | 'wrong-order' | 'different' | 'same-file' | 'same-date';

export interface PairCheck {
  kind: PairKind;
  sentence: string;
  /** True when the comparison would be empty, so there is nothing to go on to. */
  blocks: boolean;
}

/** Fewer than this share of update B's activity codes found in update A means "different schedules". */
const MATCH_THRESHOLD = 0.2;

/**
 * @param matched activities of update B whose code is also in update A.
 */
export function checkPair(a: PairFacts, b: PairFacts, matched: number): PairCheck {
  if (a.sourceHash !== '' && a.sourceHash === b.sourceHash) {
    return {
      kind: 'same-file',
      sentence: 'These are the same file. There is nothing to compare.',
      blocks: true,
    };
  }
  const matchShare = b.activities > 0 ? matched / b.activities : 0;
  const sameName = a.projectName.trim() === b.projectName.trim();
  if (!sameName && matchShare < MATCH_THRESHOLD) {
    return {
      kind: 'different',
      sentence: `These look like different schedules. The project names differ and only ${Math.round(matchShare * 100)}% of activity codes are in both. A comparison would show nearly everything as added or deleted.`,
      blocks: false,
    };
  }
  if (a.dataDate > b.dataDate) {
    return {
      kind: 'wrong-order',
      sentence: `Update A is the later one: its data date is ${longDate(a.dataDate)} and update B's is ${longDate(b.dataDate)}.`,
      blocks: false,
    };
  }
  const both = `${plural(matched, 'activity is', 'activities are')} in both updates.`;
  if (a.dataDate === b.dataDate) {
    return {
      kind: 'same-date',
      sentence: `Both updates have the data date ${longDate(a.dataDate)}. Slip will compare them as two versions of the same update. ${both}`,
      blocks: false,
    };
  }
  const project = sameName ? 'Same project' : 'The project names differ';
  return {
    kind: 'sound',
    sentence: `${project}, ${apart(a.dataDate, b.dataDate)}. ${both}`,
    blocks: false,
  };
}

export { count };
