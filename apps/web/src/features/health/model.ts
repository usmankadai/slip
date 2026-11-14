/**
 * Compares the DCMA checks of two updates for the health screen (layout A:
 * what changed first, then the rest). Pure. The counting rules themselves are
 * the engine's, in packages/engine/src/health/README.md.
 */
import type { HealthSummary } from '@slip/engine';
import { count, plural } from '../../shared/format.ts';

export type Movement = 'worse' | 'better' | 'same' | 'not-compared';

/** Checks that count relationships; the rest count activities. */
const RELATIONSHIP_CHECKS = new Set([2, 3, 4]);

/** What each check counts, in one line. From the engine's counting rules. */
const COUNTS: Record<number, string> = {
  1: 'Unfinished activities with no predecessor or no successor.',
  2: 'Relationships with a negative lag.',
  3: 'Relationships with a positive lag.',
  4: 'The share of relationships that are finish to start.',
  5: 'Unfinished activities held by a start on, finish on or mandatory constraint.',
  6: 'Unfinished activities with total float over 44 working days.',
  7: 'Unfinished activities with total float below zero.',
  8: 'Unfinished activities, not milestones, with an original duration over 44 working days.',
  9: 'Actual dates after the data date, or forecast dates before it.',
  10: 'Activities with no resources assigned.',
  11: 'Activities due by the data date that are unfinished or finished late.',
  12: 'Unfinished activities with total float of zero or less.',
  13: 'How much float the schedule has left against the length of its critical path.',
  14: 'Activities finished, against those due by the data date.',
};

export interface CheckRow {
  id: number;
  name: string;
  /** What it counts, in a sentence. */
  counts: string;
  /** "Passes at 5% or less", or "Reported only". */
  rule: string;
  /** The engine's note on this check in update B, such as why it cannot be assessed. */
  note: string;
  /** The measured figure in each update, as text. */
  was: string;
  now: string;
  /** null when the check has no pass or fail. */
  passes: boolean | null;
  movement: Movement;
  /** "+336 activities", "+2.2 points (+22 activities)", "−0.03", or '' when nothing moved. */
  change: string;
  /** True when there are activities to look at in update B. */
  hasOffenders: boolean;
}

export interface HealthView {
  worse: CheckRow[];
  better: CheckRow[];
  /** Every other check, in DCMA order. */
  rest: CheckRow[];
  /** Checks failing in update B. */
  failing: number;
  /** Checks that could be compared. */
  compared: number;
}

function figure(check: HealthSummary | undefined): string {
  if (!check || check.value === null) return 'Not assessed';
  if (check.unit === 'percent') return `${check.value.toFixed(1)}%`;
  if (check.unit === 'ratio') return check.value.toFixed(2);
  return count(Math.round(check.value));
}

function rule(check: HealthSummary): string {
  if (check.threshold === null || check.limit === null) return 'Reported only';
  if (check.unit === 'ratio') return `Passes at ${check.threshold.toFixed(2)} or more`;
  if (check.limit === 'max' && check.threshold === 0) return 'Passes at none';
  return `Passes at ${check.threshold}% or ${check.limit === 'max' ? 'less' : 'more'}`;
}

/**
 * How a check moved. It is worse if it passed and now fails, or fails in both and its
 * figure is further from its threshold; better is the reverse. Passing in both is unchanged.
 */
export function movementOf(was: HealthSummary | undefined, now: HealthSummary): Movement {
  if (!was || was.pass === null || now.pass === null) return 'not-compared';
  if (was.pass && now.pass) return 'same';
  if (was.pass !== now.pass) return now.pass ? 'better' : 'worse';
  // Fails in both: judged on the figure the threshold applies to, so a check whose share rose
  // is worse even if fewer activities are counted. With no figure, the count is used.
  if (was.value !== null && now.value !== null) {
    if (was.value === now.value) return 'same';
    const higher = now.value > was.value;
    return (now.limit === 'min' ? !higher : higher) ? 'worse' : 'better';
  }
  if (now.count === was.count) return 'same';
  return now.count > was.count ? 'worse' : 'better';
}

function changeOf(was: HealthSummary | undefined, now: HealthSummary): string {
  if (!was) return '';
  if (now.unit === 'ratio') {
    if (was.value === null || now.value === null) return '';
    const by = now.value - was.value;
    if (Math.abs(by) < 0.005) return '';
    return `${by > 0 ? '+' : '−'}${Math.abs(by).toFixed(2)}`;
  }
  const by = now.count - was.count;
  const unit = RELATIONSHIP_CHECKS.has(now.id)
    ? ['relationship', 'relationships']
    : ['activity', 'activities'];
  const counted =
    by === 0 ? '' : `${by > 0 ? '+' : '−'}${plural(Math.abs(by), unit[0]!, unit[1]!)}`;
  // A share is judged on the share, so that is said first; the count follows as detail.
  if (now.unit === 'percent' && was.value !== null && now.value !== null) {
    const points = now.value - was.value;
    if (Math.abs(points) < 0.05) return counted;
    const moved = `${points > 0 ? '+' : '−'}${Math.abs(points).toFixed(1)} points`;
    return counted ? `${moved} (${counted})` : moved;
  }
  return counted;
}

export function compareHealth(
  a: readonly HealthSummary[],
  b: readonly HealthSummary[],
): HealthView {
  const previous = new Map(a.map((check) => [check.id, check]));
  const view: HealthView = { worse: [], better: [], rest: [], failing: 0, compared: 0 };
  for (const now of [...b].sort((x, y) => x.id - y.id)) {
    const was = previous.get(now.id);
    const movement = movementOf(was, now);
    if (now.pass === false) view.failing++;
    if (movement !== 'not-compared') view.compared++;
    const row: CheckRow = {
      id: now.id,
      name: now.name,
      counts: COUNTS[now.id] ?? '',
      rule: rule(now),
      note: now.note ?? '',
      was: figure(was),
      now: figure(now),
      passes: now.pass,
      movement,
      change: changeOf(was, now),
      hasOffenders: now.count > 0,
    };
    (movement === 'worse' ? view.worse : movement === 'better' ? view.better : view.rest).push(row);
  }
  return view;
}

/** The sentence that answers "is this schedule getting better or worse?". */
export function healthHeadline(view: HealthView): string {
  if (view.compared === 0) return 'The checks could not be compared between these updates';
  if (view.worse.length === 0 && view.better.length === 0) return 'No check got worse or better';
  const worse = `${plural(view.worse.length, 'check')} got worse`;
  const better = `${count(view.better.length)} got better`;
  if (view.better.length === 0) return worse;
  if (view.worse.length === 0) return `${plural(view.better.length, 'check')} got better`;
  return `${worse}, ${better}`;
}
