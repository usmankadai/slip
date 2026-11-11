/**
 * What the update summary shows, worked out from small engine results.
 * Decisions behind it (11 November 2026): every milestone counts, the largest
 * moves are shown, later before earlier, and the dates are the ones stored in
 * each file, not Slip's recalculated ones.
 */
import type { HealthSummary } from '@slip/engine';
import { count, plural } from '../../shared/format.ts';
import type { ChangeKind } from '../changes/model.ts';
import type { SlotFacts } from '../import/types.ts';

/** How many milestone rows the summary shows. The full list belongs in the changes view. */
export const MILESTONE_ROWS = 20;

export interface MilestoneRow {
  code: string;
  name: string;
  /** Finish in update A and update B, minutes since the epoch. */
  was: number;
  now: number;
  /** Finish slip in working days on the milestone's own calendar. Positive is later. */
  days: number;
}

export interface MilestoneList {
  rows: MilestoneRow[];
  /** Milestones whose finish moved. */
  moved: number;
  /** Every milestone in update B. */
  total: number;
  /** How many moved later and earlier, or null when there are too many to tell from what was fetched. */
  later: number | null;
  earlier: number | null;
}

/**
 * Builds the list from the largest later moves and the largest earlier moves, each already
 * sorted by size and at most MILESTONE_ROWS long. Later moves come first.
 */
export function milestoneList(
  largestLater: MilestoneRow[],
  largestEarlier: MilestoneRow[],
  moved: number,
  total: number,
): MilestoneList {
  const later = largestLater.filter((row) => row.days > 0);
  const earlier = largestEarlier.filter((row) => row.days < 0);
  // A fetch that came back short of its limit has seen every move on that side.
  const sawLater = later.length < MILESTONE_ROWS;
  const sawEarlier = earlier.length < MILESTONE_ROWS;
  const laterCount = sawLater ? later.length : sawEarlier ? moved - earlier.length : null;
  const earlierCount = sawEarlier ? earlier.length : sawLater ? moved - later.length : null;
  return {
    rows: [...later, ...earlier].slice(0, MILESTONE_ROWS),
    moved,
    total,
    later: laterCount,
    earlier: earlierCount,
  };
}

/** The heading of the milestone box: the answer to "what happened this month". */
export function milestoneHeading(list: MilestoneList): string {
  if (list.total === 0) return 'This schedule has no milestones';
  if (list.moved === 0) return 'No milestone moved';
  const base = `${plural(list.moved, 'milestone')} moved`;
  if (list.moved <= list.rows.length || list.later === null || list.earlier === null) return base;
  return `${base}: ${count(list.later)} later, ${count(list.earlier)} earlier`;
}

export interface ChangeLine {
  label: string;
  value: number;
  /** The filter the changes grid opens with for this line, or null when the grid cannot show it. */
  kind: ChangeKind | null;
}

export interface ChangeCounts {
  datesMoved: number;
  durationChanged: number;
  logicChanged: number;
  constraintChanged: number;
  progressed: number;
  added: number;
  removed: number;
  activities: number;
  joinedCritical: number;
  leftCritical: number;
}

export function changeLines(counts: ChangeCounts): ChangeLine[] {
  return [
    { label: 'Dates moved', value: counts.datesMoved, kind: 'dates' },
    { label: 'Durations changed', value: counts.durationChanged, kind: 'durations' },
    { label: 'Logic changed', value: counts.logicChanged, kind: 'logic' },
    { label: 'Constraints changed', value: counts.constraintChanged, kind: 'constraints' },
    { label: 'Progressed', value: counts.progressed, kind: 'progress' },
    { label: 'Added', value: counts.added, kind: 'added' },
    { label: 'Removed', value: counts.removed, kind: null },
  ];
}

export function nothingChanged(counts: ChangeCounts): boolean {
  return changeLines(counts).every((line) => line.value === 0);
}

export function criticalSentence(counts: ChangeCounts): string {
  if (counts.joinedCritical === 0 && counts.leftCritical === 0) {
    return 'No activity joined or left the critical path.';
  }
  return `${plural(counts.joinedCritical, 'activity', 'activities')} joined, ${count(counts.leftCritical)} left.`;
}

export interface HealthDelta {
  worse: number;
  better: number;
  /** Checks failing in update B. */
  failing: number;
  /** Checks that could be assessed in both updates. */
  assessed: number;
  /** The check that got worse by the most, as a phrase, or '' when none did. */
  worst: string;
}

/** Compares the DCMA checks of the two updates. A check is worse if it now fails, or fails by more. */
export function healthDelta(a: readonly HealthSummary[], b: readonly HealthSummary[]): HealthDelta {
  const previous = new Map(a.map((check) => [check.id, check]));
  const delta: HealthDelta = { worse: 0, better: 0, failing: 0, assessed: 0, worst: '' };
  let worstBy = 0;
  for (const now of b) {
    if (now.pass === false) delta.failing++;
    const was = previous.get(now.id);
    if (!was || was.pass === null || now.pass === null) continue;
    delta.assessed++;
    const by = now.count - was.count;
    const worse = (was.pass && !now.pass) || (!was.pass && !now.pass && by > 0);
    const better = (!was.pass && now.pass) || (!was.pass && !now.pass && by < 0);
    if (worse) {
      delta.worse++;
      if (by > worstBy || delta.worst === '') {
        worstBy = by;
        delta.worst = by > 0 ? `${now.name}, ${count(by)} more than in update A` : now.name;
      }
    } else if (better) {
      delta.better++;
    }
  }
  return delta;
}

export function healthSentence(delta: HealthDelta): string {
  if (delta.assessed === 0) return 'The checks could not be compared between these updates.';
  if (delta.worse === 0 && delta.better === 0) {
    return `All ${plural(delta.assessed, 'check')} are as they were. ${count(delta.failing)} fail in update B.`;
  }
  const parts = `${plural(delta.worse, 'check')} worse, ${count(delta.better)} better.`;
  return delta.worst ? `${parts} Worst: ${delta.worst}.` : parts;
}

/** Lines said above the answer when something about the files makes the numbers less trustworthy. */
export function carriedNotices(facts: { a: SlotFacts; b: SlotFacts }): string[] {
  const notices: string[] = [];
  for (const id of ['a', 'b'] as const) {
    const slot = facts[id];
    const name = `Update ${id.toUpperCase()}`;
    if (slot.incomplete) {
      notices.push(
        `${name} is incomplete: the file stopped early and some of it is missing. Dates below may differ from P6.`,
      );
    }
    const dates = slot.report.groups.find((group) => group.id === 'dates');
    // The incomplete file is already one of these warnings; do not say it twice.
    const others = (dates?.total ?? 0) - (slot.incomplete ? 1 : 0);
    if (others > 0) {
      notices.push(
        `${plural(others, 'import warning')} in update ${id.toUpperCase()} may change dates.`,
      );
    }
  }
  return notices;
}

export function recalculationNotice(differsFromFile: number): string {
  return differsFromFile > 0
    ? `Slip's own calculation gives a different finish for ${plural(differsFromFile, 'activity', 'activities')} in update B. This summary uses the dates stored in the files.`
    : '';
}

/** A part of the screen that loads, and can fail, on its own. */
export type Loadable<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T };

export interface SummaryState {
  milestones: Loadable<MilestoneList>;
  changes: Loadable<ChangeCounts>;
  health: Loadable<HealthDelta>;
  /** Sentence for a schedule with no milestones: where the latest finish went. '' until known. */
  latestFinish: string;
  /** '' when Slip's recalculated dates agree with the file, or while that is not yet known. */
  recalculation: string;
}

export const LOADING_STATE: SummaryState = {
  milestones: { status: 'loading' },
  changes: { status: 'loading' },
  health: { status: 'loading' },
  latestFinish: '',
  recalculation: '',
};
