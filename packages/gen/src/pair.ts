/**
 * Builds a pair of updates of one synthetic schedule, and the facts about
 * the second update that tests assert on (`expected`).
 *
 * Update 01 is the plan, statused as if all work had gone to plan.
 * Update 02 is four weeks later, with scripted changes: durations grown on
 * the chain that drives completion, plus the ordinary churn of a monthly
 * update (other durations, logic, constraints, added and deleted work).
 */
import { addWork, workBetween, type WorkClock } from '@slip/engine';
import {
  ConstraintType,
  MINUTES_PER_DAY,
  RelType,
  Status,
  TaskType,
  formatXerDate,
} from '@slip/xer';
import {
  addActivity,
  addRelationship,
  buildNetwork,
  cloneNetwork,
  type Network,
} from './network.ts';
import { seeded, type Random } from './rng.ts';
import {
  buildLinks,
  drivingPath,
  makeClocks,
  noProgress,
  progressAt,
  schedule,
  type Schedule,
} from './schedule.ts';
import type { Sector } from './vocabulary.ts';

export interface GenOptions {
  activities: number;
  seed: number;
  sector: Sector;
}

export interface Update {
  net: Network;
  schedule: Schedule;
  /** The plan dates, written as the planned ("target") dates in both updates. */
  baseline: Schedule;
  /** Added to an activity's index to make its task_id. Differs between updates on purpose (decision D4). */
  idBase: number;
}

export interface Expected {
  options: GenOptions;
  update01: { activities: number; relationships: number; dataDate: string };
  update02: { activities: number; relationships: number; dataDate: string };
  /** The milestone the trace feature is tested on. */
  milestone: {
    code: string;
    finish01: string;
    finish02: string;
    slipMinutes: number;
    slipWorkingDays: number;
  };
  /** Activities on the chain driving the milestone whose durations were grown, largest first. */
  drivers: { code: string; growthMinutes: number; growthWorkingDays: number }[];
  changes: {
    added: string[];
    removed: string[];
    durationChanged: string[];
    constraintAdded: string[];
    /** [predecessor code, successor code, type] */
    relationshipAdded: [string, string, string][];
    relationshipRemoved: [string, string, string][];
    lagChanged: [string, string, string][];
  };
}

export interface Pair {
  update01: Update;
  update02: Update;
  expected: Expected;
}

const REL_NAMES: Record<number, string> = {
  [RelType.FS]: 'FS',
  [RelType.SS]: 'SS',
  [RelType.FF]: 'FF',
  [RelType.SF]: 'SF',
};

function liveCounts(net: Network): { activities: number; relationships: number } {
  let activities = 0;
  for (let i = 0; i < net.code.length; i++) if (!net.removed[i]) activities++;
  let relationships = 0;
  for (let r = 0; r < net.relPred.length; r++) {
    if (!net.relRemoved[r] && !net.removed[net.relPred[r]!] && !net.removed[net.relSucc[r]!]) {
      relationships++;
    }
  }
  return { activities, relationships };
}

/** Picks `count` distinct items for which `allowed` holds, or as many as exist. Gives up politely on sparse pools. */
function pick(
  random: Random,
  size: number,
  count: number,
  allowed: (index: number) => boolean,
): number[] {
  const chosen = new Set<number>();
  for (let attempt = 0; attempt < count * 40 && chosen.size < count; attempt++) {
    const index = Math.floor(random() * size);
    if (!chosen.has(index) && allowed(index)) chosen.add(index);
  }
  return [...chosen].sort((a, b) => a - b);
}

/** Adds planning constraints to the plan, placed relative to the unconstrained dates. */
function addPlanConstraints(
  net: Network,
  unconstrained: Schedule,
  clocks: WorkClock[],
  random: Random,
): void {
  const n = net.code.length;
  for (let i = 0; i < n; i++) {
    const type = net.type[i]!;
    if (type === TaskType.FinishMilestone && i !== net.completion) {
      // Phase milestones carry a contractual date with ten working days in hand.
      const clock = clocks[net.calendar[i]!]!;
      net.constraintType[i] = ConstraintType.FinishOnOrBefore;
      net.constraintDate[i] = addWork(
        clock,
        unconstrained.earlyFinish[i]!,
        10 * clock.calendar.dayMinutes,
      );
    } else if (type === TaskType.Task) {
      const roll = random();
      if (roll < 0.01) {
        // "Not before" dates: access, possessions, deliveries.
        net.constraintType[i] = ConstraintType.StartOnOrAfter;
        net.constraintDate[i] =
          unconstrained.earlyStart[i]! + Math.floor(random() * 10) * MINUTES_PER_DAY;
      } else if (roll < 0.013) {
        net.constraintType[i] = ConstraintType.StartOn;
        net.constraintDate[i] = unconstrained.earlyStart[i]!;
      }
    }
  }
}

export function generatePair(options: GenOptions): Pair {
  const random = seeded(options.seed);
  const net1 = buildNetwork(options.activities, options.sector, random);
  const clocks = makeClocks(net1);
  const n1 = net1.code.length;

  // The plan: schedule once to place constraints sensibly, then again with them.
  let links = buildLinks(net1);
  const unconstrained = schedule(net1, clocks, links, net1.projectStart, noProgress(n1));
  addPlanConstraints(net1, unconstrained, clocks, random);
  const plan = schedule(net1, clocks, links, net1.projectStart, noProgress(n1));

  // Update 01: about 30% of the way through, everything to plan.
  const span = plan.earlyFinish[net1.completion]! - net1.projectStart;
  const dataDate1 =
    Math.floor((net1.projectStart + span * 0.3) / MINUTES_PER_DAY) * MINUTES_PER_DAY + 8 * 60;
  const schedule1 = schedule(
    net1,
    clocks,
    links,
    dataDate1,
    progressAt(net1, clocks, plan, dataDate1),
  );

  // Update 02: four weeks later.
  const dataDate2 = dataDate1 + 28 * MINUTES_PER_DAY;
  const net2 = cloneNetwork(net1);
  const future = (i: number) =>
    schedule1.status[i] === Status.NotStarted && schedule1.earlyStart[i]! >= dataDate2;
  const isTask = (i: number) => net2.type[i] === TaskType.Task;

  // 1. Grow durations on the chain that drives completion.
  const path = drivingPath(net1, clocks, links, schedule1, net1.completion);
  const onPath = new Uint8Array(n1);
  for (const i of path) onPath[i] = 1;
  // Growing an activity only delays the milestone if its finish is what drives the next
  // activity on the chain. One tied start to start would absorb the growth.
  const drivesByFinish = new Uint8Array(n1);
  for (let k = 1; k < path.length; k++) {
    const pred = path[k]!;
    const succ = path[k - 1]!;
    for (let at = links.predOffsets[succ]!; at < links.predOffsets[succ + 1]!; at++) {
      const r = links.predRels[at]!;
      const type = net1.relType[r]!;
      if (net1.relPred[r] === pred && (type === RelType.FS || type === RelType.FF))
        drivesByFinish[pred] = 1;
    }
  }
  const candidates = path.filter(
    (i) => isTask(i) && future(i) && net1.calendar[i] !== 2 && drivesByFinish[i] === 1,
  );
  const driverCount = Math.min(
    candidates.length,
    Math.max(3, Math.round(Math.log10(options.activities)) + 1),
  );
  const drivers: { index: number; growth: number }[] = [];
  for (let k = 0; k < driverCount; k++) {
    // Spread the picks along the chain.
    const index = candidates[Math.floor(((k + 0.5) * candidates.length) / driverCount)]!;
    const growth =
      (8 + Math.floor(random() * 13)) * clocks[net2.calendar[index]!]!.calendar.dayMinutes;
    net2.duration[index]! += growth;
    drivers.push({ index, growth });
  }

  // Everything below stays off the driving chain, so the scripted slip is the story.
  const touched = new Uint8Array(n1);
  for (const { index } of drivers) touched[index] = 1;
  const free = (i: number) => isTask(i) && future(i) && !onPath[i] && !touched[i];
  const take = (count: number) => {
    const chosen = pick(random, n1, count, free);
    for (const i of chosen) touched[i] = 1;
    return chosen;
  };
  const scale = (per: number, least: number) =>
    Math.max(least, Math.round(options.activities / per));

  // 2. Other duration changes.
  const durationChanged = take(scale(200, 2));
  for (const i of durationChanged) {
    const dayMinutes = clocks[net2.calendar[i]!]!.calendar.dayMinutes;
    const days = net2.duration[i]! / dayMinutes;
    const change =
      random() < 0.7
        ? 1 + Math.floor(random() * 5)
        : -Math.min(days - 1, 1 + Math.floor(random() * 3));
    net2.duration[i] = (days + (change === 0 ? 1 : change)) * dayMinutes;
  }

  // 3. Deleted activities.
  const removed = take(scale(1000, 2));
  for (const i of removed) net2.removed[i] = 1;

  // 4. New constraints.
  const constraintAdded = take(scale(1000, 1));
  for (const i of constraintAdded) {
    net2.constraintType[i] = ConstraintType.StartOnOrAfter;
    net2.constraintDate[i] =
      schedule1.earlyStart[i]! + (5 + Math.floor(random() * 10)) * MINUTES_PER_DAY;
  }

  // 5. Logic changes: relationships removed, lags changed, relationships added.
  const relCount = net1.relPred.length;
  const freeRel = (r: number) => {
    const pred = net1.relPred[r]!;
    const succ = net1.relSucc[r]!;
    return (
      isTask(pred) &&
      isTask(succ) &&
      future(pred) &&
      future(succ) &&
      !onPath[pred] &&
      !onPath[succ] &&
      !net2.removed[pred] &&
      !net2.removed[succ]
    );
  };
  const relTouched = new Set<number>();
  const takeRel = (count: number) => {
    const chosen = pick(random, relCount, count, (r) => !relTouched.has(r) && freeRel(r));
    for (const r of chosen) relTouched.add(r);
    return chosen;
  };
  const relationshipRemoved = takeRel(scale(2000, 1));
  for (const r of relationshipRemoved) net2.relRemoved[r] = 1;
  const lagChanged = takeRel(scale(2000, 1));
  for (const r of lagChanged) {
    net2.relLag[r]! +=
      (1 + Math.floor(random() * 5)) *
      clocks[net2.calendar[net2.relPred[r]!]!]!.calendar.dayMinutes;
  }
  const existing = new Set<number>();
  for (let r = 0; r < relCount; r++) existing.add(net1.relPred[r]! * n1 + net1.relSucc[r]!);
  const relationshipAdded: [number, number][] = [];
  const wanted = scale(1000, 2);
  for (let attempt = 0; attempt < wanted * 400 && relationshipAdded.length < wanted; attempt++) {
    // A planner formalising a sequence that already holds: both activities are in the same
    // work package and the successor already starts after the predecessor finishes. A link
    // across areas would chain parallel work together and swamp the scripted slip.
    const pred = Math.floor(random() * n1);
    const succ = pred + 2 + Math.floor(random() * 10);
    if (succ >= n1 || existing.has(pred * n1 + succ)) continue;
    if (net1.wbs[pred] !== net1.wbs[succ]) continue;
    if (schedule1.earlyStart[succ]! < schedule1.earlyFinish[pred]!) continue;
    const usable = (i: number) => isTask(i) && future(i) && !onPath[i] && !net2.removed[i];
    if (!usable(pred) || !usable(succ)) continue;
    existing.add(pred * n1 + succ);
    addRelationship(net2, pred, succ, RelType.FS, 0);
    relationshipAdded.push([pred, succ]);
  }

  // 6. Added activities, each hung off an existing one in the same work package.
  const hosts = pick(random, n1, scale(500, 2), (i) => isTask(i) && future(i) && !net2.removed[i]);
  const added: number[] = [];
  hosts.forEach((host, k) => {
    const calendar = net2.calendar[host]!;
    const prefix = net2.code[host]!.slice(0, net2.code[host]!.lastIndexOf('-'));
    const index = addActivity(
      net2,
      `${prefix}-N${String(k + 1).padStart(4, '0')}`,
      `Additional works following ${net2.name[host]!.charAt(0).toLowerCase()}${net2.name[host]!.slice(1)}`,
      net2.wbs[host]!,
      calendar,
      TaskType.Task,
      (2 + Math.floor(random() * 9)) * clocks[calendar]!.calendar.dayMinutes,
    );
    addRelationship(net2, host, index, RelType.FS, 0);
    added.push(index);
  });

  // Status update 02 as if work to date had followed update 01, then reschedule.
  links = buildLinks(net2);
  const n2 = net2.code.length;
  const progress2 = noProgress(n2);
  const toPlan = progressAt(net1, clocks, schedule1, dataDate2);
  progress2.actualStart.set(toPlan.actualStart);
  progress2.actualFinish.set(toPlan.actualFinish);
  progress2.remaining.set(toPlan.remaining);
  const schedule2 = schedule(net2, clocks, links, dataDate2, progress2);

  // The baseline for update 02 is the original plan; added activities take their first dates.
  const baseline2: Schedule = {
    ...plan,
    earlyStart: new Int32Array(n2),
    earlyFinish: new Int32Array(n2),
  };
  baseline2.earlyStart.set(schedule2.earlyStart);
  baseline2.earlyFinish.set(schedule2.earlyFinish);
  baseline2.earlyStart.set(plan.earlyStart); // overwrites the first n1 entries
  baseline2.earlyFinish.set(plan.earlyFinish);

  const milestoneClock = clocks[net1.calendar[net1.completion]!]!;
  const finish1 = schedule1.earlyFinish[net1.completion]!;
  const finish2 = schedule2.earlyFinish[net2.completion]!;
  const slipMinutes = workBetween(milestoneClock, finish1, finish2);
  const code = (i: number) => net2.code[i]!;
  const relCodes = (r: number): [string, string, string] => [
    code(net2.relPred[r]!),
    code(net2.relSucc[r]!),
    REL_NAMES[net2.relType[r]!]!,
  ];

  const expected: Expected = {
    options,
    update01: { ...liveCounts(net1), dataDate: formatXerDate(dataDate1) },
    update02: { ...liveCounts(net2), dataDate: formatXerDate(dataDate2) },
    milestone: {
      code: code(net1.completion),
      finish01: formatXerDate(finish1),
      finish02: formatXerDate(finish2),
      slipMinutes,
      slipWorkingDays: slipMinutes / milestoneClock.calendar.dayMinutes,
    },
    drivers: drivers
      .map(({ index, growth }) => ({
        code: code(index),
        growthMinutes: growth,
        growthWorkingDays: growth / clocks[net2.calendar[index]!]!.calendar.dayMinutes,
      }))
      .sort((a, b) => b.growthMinutes - a.growthMinutes || (a.code < b.code ? -1 : 1)),
    changes: {
      added: added.map(code),
      removed: removed.map(code),
      durationChanged: [...drivers.map((d) => d.index), ...durationChanged]
        .sort((a, b) => a - b)
        .map(code),
      constraintAdded: constraintAdded.map(code),
      relationshipAdded: relationshipAdded.map(([pred, succ]) => [code(pred), code(succ), 'FS']),
      relationshipRemoved: relationshipRemoved.map(relCodes),
      lagChanged: lagChanged.map(relCodes),
    },
  };

  return {
    update01: { net: net1, schedule: schedule1, baseline: plan, idBase: 100_000 },
    update02: { net: net2, schedule: schedule2, baseline: baseline2, idBase: 5_000_000 },
    expected,
  };
}
