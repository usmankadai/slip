/**
 * Turns the engine's trace into what the trace screen shows (exploration 03):
 * the ranked causes, which are the answer, and the driving path, which is the
 * evidence. Pure.
 */
import { TraceEnd, type ContributionKind } from '@slip/engine';
import { count, plural } from '../../shared/format.ts';

/** The part of the engine's trace result this screen uses. */
export interface TraceInput {
  /** The milestone's finish slip in working days. */
  slipWorkingDays: number;
  /** True when the milestone is new in update B, so there is no slip to explain. */
  isNew: boolean;
  /** Activities on the driving network, the target first, then in the order reached. */
  nodes: ArrayLike<number>;
  depth: ArrayLike<number>;
  end: ArrayLike<number>;
  codes: readonly string[];
  names: readonly string[];
  slipDays: readonly (number | null)[];
  contributors: readonly { activity: number; kind: ContributionKind; workingDays: number }[];
  truncated: boolean;
}

const KIND_WORDS: Record<ContributionKind, [later: string, earlier: string]> = {
  duration: ['Duration grew', 'Duration shortened'],
  progress: ['Taking longer', 'Recovered time'],
  logic: ['Logic changed', 'Logic changed'],
  constraint: ['Held by a constraint', 'Constraint eased'],
  added: ['New activity', 'New activity'],
  'driver-changed': ['Became the driver', 'Stopped driving'],
};

export interface Cause {
  activity: number;
  code: string;
  name: string;
  /** What happened, in words, largest part first. */
  what: string[];
  /** Working days this activity added of its own. Negative means it recovered time. */
  days: number;
  /** Its part of the slip that was added, 0 to 1, or null for a recovery. */
  share: number | null;
}

export interface PathStep {
  /** An activity on the path, or a run of activities that passed the slip on unchanged. */
  kind: 'activity' | 'passed';
  /** For `passed`: how many activities. */
  passed: number;
  code: string;
  name: string;
  what: string[];
  /** Working days it added of its own. */
  own: number;
  /** Slip it arrived with, in working days, or null when it cannot be compared. */
  inherited: number | null;
  /** Why the trace stops here, or '' when it carries on to a predecessor. */
  stops: string;
  target: boolean;
}

export interface TraceView {
  slipDays: number;
  /** Causes always listed, largest first. */
  causes: Cause[];
  /** Smaller causes, folded into one line until asked for. */
  minor: Cause[];
  minorDays: number;
  /** Activities on the path that added nothing. */
  passedOn: number;
  /** Working days of the slip that the causes do not account for; 0 when they add up. */
  unexplained: number;
  /** Furthest back first, ending at the milestone. */
  path: PathStep[];
  /** One sentence on where the driving path, or paths, begin. */
  begins: string;
  truncated: boolean;
  /** The largest slip on the path, for scaling its bars. */
  pathScale: number;
}

/** Causes are always listed down to this many; smaller ones beyond it fold away. */
export const ALWAYS_LISTED = 5;
/** A cause under this many working days folds away once ALWAYS_LISTED are shown. */
export const MINOR_DAYS = 3;
/** A difference smaller than this between the causes and the slip is rounding, not a gap. */
const ROUNDING = 0.5;
const SMALL = 0.05;

const STOP_WORDS: Record<number, string> = {
  [TraceEnd.Complete]: 'finished work',
  [TraceEnd.DataDate]: 'the data date',
  [TraceEnd.Constraint]: 'a constraint',
  [TraceEnd.NoPredecessor]: 'an activity with no predecessor',
  [TraceEnd.Limit]: 'the limit of the trace',
};

const STOP_SENTENCE: Record<number, string> = {
  [TraceEnd.Complete]: 'The trace stops here: this work is finished, so its dates are history.',
  [TraceEnd.DataDate]:
    'The trace stops here: nothing holds this but the data date. It has not started when it could have.',
  [TraceEnd.Constraint]: 'The trace stops here: a constraint holds this activity.',
  [TraceEnd.NoPredecessor]: 'The trace stops here: this activity has no predecessor.',
  [TraceEnd.Limit]: 'The trace reached its size limit here. The path goes further back.',
};

export function buildTrace(input: TraceInput): TraceView {
  // What each activity added: the sum of its contributions, with the words for each part.
  const own = new Map<number, { days: number; what: [string, number][] }>();
  for (const part of input.contributors) {
    if (!Number.isFinite(part.workingDays) || Math.abs(part.workingDays) < SMALL) continue;
    const entry = own.get(part.activity) ?? { days: 0, what: [] };
    entry.days += part.workingDays;
    const words = KIND_WORDS[part.kind] ?? ['Changed', 'Changed'];
    entry.what.push([part.workingDays > 0 ? words[0] : words[1], Math.abs(part.workingDays)]);
    own.set(part.activity, entry);
  }
  const whatOf = (activity: number) =>
    [...(own.get(activity)?.what ?? [])]
      .sort((x, y) => y[1] - x[1])
      .map(([word]) => word)
      .filter((word, index, all) => all.indexOf(word) === index);

  const position = new Map<number, number>();
  for (let k = 0; k < input.nodes.length; k++) position.set(input.nodes[k]!, k);

  let added = 0;
  let total = 0;
  for (const entry of own.values()) {
    total += entry.days;
    if (entry.days > 0) added += entry.days;
  }
  const ranked: Cause[] = [...own.entries()]
    .filter(([, entry]) => Math.abs(entry.days) >= SMALL)
    .map(([activity, entry]) => {
      const at = position.get(activity);
      return {
        activity,
        code: at === undefined ? '' : (input.codes[at] ?? ''),
        name: at === undefined ? '' : (input.names[at] ?? ''),
        what: whatOf(activity),
        days: entry.days,
        share: entry.days > 0 && added > 0 ? entry.days / added : null,
      };
    })
    .sort((x, y) => Math.abs(y.days) - Math.abs(x.days) || x.activity - y.activity);
  // The largest few are always listed; after that, small causes fold away.
  const cut = ranked.findIndex(
    (cause, index) => index >= ALWAYS_LISTED && Math.abs(cause.days) < MINOR_DAYS,
  );
  const causes = cut < 0 ? ranked : ranked.slice(0, cut);
  const minor = cut < 0 ? [] : ranked.slice(causes.length);

  // The path, furthest back first. The target is node 0 and comes last.
  const order = Array.from({ length: input.nodes.length }, (_, k) => k)
    .filter((k) => k !== 0)
    .sort((x, y) => input.depth[y]! - input.depth[x]! || x - y);
  const path: PathStep[] = [];
  let run = 0;
  let passedOn = 0;
  let pathScale = Math.abs(input.slipWorkingDays);
  const flush = () => {
    if (run > 0) {
      path.push({
        kind: 'passed',
        passed: run,
        code: '',
        name: '',
        what: [],
        own: 0,
        inherited: null,
        stops: '',
        target: false,
      });
    }
    run = 0;
  };
  const step = (k: number, target: boolean): PathStep => {
    const activity = input.nodes[k]!;
    const days = own.get(activity)?.days ?? 0;
    const slip = input.slipDays[k] ?? null;
    const inherited = slip === null ? null : slip - days;
    if (slip !== null) pathScale = Math.max(pathScale, Math.abs(slip), Math.abs(inherited ?? 0));
    return {
      kind: 'activity',
      passed: 0,
      code: input.codes[k] ?? '',
      name: input.names[k] ?? '',
      what: whatOf(activity),
      own: days,
      inherited,
      stops: STOP_SENTENCE[input.end[k]!] ?? '',
      target,
    };
  };
  const stops = new Map<number, number>();
  for (const k of order) {
    const activity = input.nodes[k]!;
    const reason = input.end[k]!;
    if (reason !== TraceEnd.Driven) stops.set(reason, (stops.get(reason) ?? 0) + 1);
    const days = own.get(activity)?.days ?? 0;
    if (Math.abs(days) < SMALL && reason === TraceEnd.Driven) {
      run++;
      passedOn++;
      continue;
    }
    if (Math.abs(days) < SMALL) passedOn++;
    flush();
    path.push(step(k, false));
  }
  flush();
  if (input.nodes.length > 0) path.push(step(0, true));

  const reasons = [...stops.entries()].sort((x, y) => y[1] - x[1]);
  const begins =
    reasons.length === 0
      ? ''
      : reasons.length === 1 && reasons[0]![1] === 1
        ? `The driving path begins at ${STOP_WORDS[reasons[0]![0]] ?? 'its first activity'}.`
        : `The driving paths begin at ${reasons
            .map(([reason, times]) => `${STOP_WORDS[reason] ?? 'an activity'} (${count(times)})`)
            .join(', ')}.`;

  const gap = input.slipWorkingDays - total;
  return {
    slipDays: input.slipWorkingDays,
    causes,
    minor,
    minorDays: minor.reduce((sum, cause) => sum + cause.days, 0),
    passedOn,
    unexplained: Math.abs(gap) >= ROUNDING ? gap : 0,
    path,
    begins,
    truncated: input.truncated,
    pathScale: pathScale || 1,
  };
}

/** The line under the causes that says what the rest of the path did. */
export function passedOnSentence(view: TraceView): string {
  if (view.passedOn === 0) return '';
  return `${plural(view.passedOn, 'activity', 'activities')} on the path passed the slip on without adding to it.`;
}
