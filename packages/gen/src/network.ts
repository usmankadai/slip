/**
 * Builds the logic network for a synthetic schedule: WBS, activities,
 * relationships and calendars. No dates yet; schedule.ts works those out.
 *
 * Every relationship runs from a lower activity index to a higher one, so
 * index order is a valid scheduling order and the network cannot loop.
 */
import {
  ConstraintType,
  NONE,
  RelType,
  TaskType,
  epochDay,
  parseXerDate,
  type Calendar,
} from '@slip/xer';
import type { Random } from './rng.ts';
import { VOCABULARY, type Sector } from './vocabulary.ts';

export interface Network {
  projectName: string;
  /** Wall-clock minute the project starts. */
  projectStart: number;
  calendars: Calendar[];

  // One entry per activity.
  code: string[];
  name: string[];
  wbs: number[];
  calendar: number[];
  type: number[];
  /** Original duration in minutes of the activity's own calendar. */
  duration: number[];
  constraintType: number[];
  constraintDate: number[];
  /** 1 when the activity has been deleted in this update. */
  removed: number[];

  // One entry per relationship.
  relPred: number[];
  relSucc: number[];
  relType: number[];
  relLag: number[];
  relRemoved: number[];

  // One entry per WBS node.
  wbsParent: number[];
  wbsCode: string[];
  wbsName: string[];

  /** Index of the project completion milestone. */
  completion: number;
}

const WORK_DAY = [480, 720, 780, 1020];
const HOLIDAYS = [
  [1, 1],
  [12, 25],
  [12, 26],
];

function makeCalendars(startYear: number): Calendar[] {
  const days: number[] = [];
  for (let year = startYear - 2; year < startYear + 80; year++) {
    for (const [month, day] of HOLIDAYS) days.push(epochDay(year, month!, day!));
  }
  days.sort((a, b) => a - b);
  const holidays = () => ({
    exceptionDays: Int32Array.from(days),
    exceptionPeriods: days.map(() => [] as number[]),
  });
  return [
    {
      id: 601,
      name: 'Standard 5 day',
      dayMinutes: 480,
      week: [[], WORK_DAY, WORK_DAY, WORK_DAY, WORK_DAY, WORK_DAY, []],
      parsed: true,
      ...holidays(),
    },
    {
      id: 602,
      name: 'Site 6 day',
      dayMinutes: 480,
      week: [[], WORK_DAY, WORK_DAY, WORK_DAY, WORK_DAY, WORK_DAY, WORK_DAY],
      parsed: true,
      ...holidays(),
    },
    {
      id: 603,
      name: 'Continuous 7 day',
      dayMinutes: 1440,
      week: [
        [0, 1440],
        [0, 1440],
        [0, 1440],
        [0, 1440],
        [0, 1440],
        [0, 1440],
        [0, 1440],
      ],
      parsed: true,
      exceptionDays: new Int32Array(0),
      exceptionPeriods: [],
    },
  ];
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

export function emptyNetwork(
  projectName: string,
  projectStart: number,
  calendars: Calendar[],
): Network {
  return {
    projectName,
    projectStart,
    calendars,
    code: [],
    name: [],
    wbs: [],
    calendar: [],
    type: [],
    duration: [],
    constraintType: [],
    constraintDate: [],
    removed: [],
    relPred: [],
    relSucc: [],
    relType: [],
    relLag: [],
    relRemoved: [],
    wbsParent: [],
    wbsCode: [],
    wbsName: [],
    completion: -1,
  };
}

export function addActivity(
  net: Network,
  code: string,
  name: string,
  wbs: number,
  calendar: number,
  type: number,
  duration: number,
): number {
  net.code.push(code);
  net.name.push(name);
  net.wbs.push(wbs);
  net.calendar.push(calendar);
  net.type.push(type);
  net.duration.push(duration);
  net.constraintType.push(ConstraintType.None);
  net.constraintDate.push(NONE);
  net.removed.push(0);
  return net.code.length - 1;
}

export function addRelationship(
  net: Network,
  pred: number,
  succ: number,
  type: number,
  lag: number,
): void {
  if (pred >= succ) throw new Error('Relationships must run from a lower index to a higher one.');
  net.relPred.push(pred);
  net.relSucc.push(succ);
  net.relType.push(type);
  net.relLag.push(lag);
  net.relRemoved.push(0);
}

function addWbs(net: Network, parent: number, code: string, name: string): number {
  net.wbsParent.push(parent);
  net.wbsCode.push(code);
  net.wbsName.push(name);
  return net.wbsCode.length - 1;
}

/** How the activity count is split into phases, areas and disciplines. */
export function shape(activities: number): { phases: number; areas: number; disciplines: number } {
  let packages = Math.max(1, Math.round((activities - 2) / 25));
  let phases = clamp(Math.round(Math.cbrt(packages)), 1, 40);
  let disciplines = clamp(Math.round(Math.cbrt(packages)), 1, 8);
  let areas = Math.max(1, Math.ceil(packages / (phases * disciplines)));
  // Small schedules: shrink until every work package can hold at least three tasks.
  for (;;) {
    packages = phases * areas * disciplines;
    if (activities - 2 - phases >= packages * 3) break;
    if (areas > 1) areas--;
    else if (disciplines > 1) disciplines--;
    else if (phases > 1) phases--;
    else break;
  }
  return { phases, areas, disciplines };
}

export function buildNetwork(activities: number, sector: Sector, random: Random): Network {
  if (!Number.isInteger(activities) || activities < 10) {
    throw new RangeError('A synthetic schedule needs at least 10 activities.');
  }
  const words = VOCABULARY[sector];
  const projectStart = parseXerDate('2026-01-05 08:00');
  const calendars = makeCalendars(2026);
  const net = emptyNetwork(`${words.project}-${activities}`, projectStart, calendars);
  const { phases, areas, disciplines } = shape(activities);
  const packages = phases * areas * disciplines;
  const taskTotal = activities - 2 - phases;
  const baseSize = Math.floor(taskTotal / packages);
  const extra = taskTotal % packages;

  const root = addWbs(net, -1, words.project, words.projectName);
  const milestoneNode = addWbs(net, root, 'MS', 'Milestones');
  const start = addActivity(
    net,
    'MS-START',
    'Contract start',
    milestoneNode,
    0,
    TaskType.StartMilestone,
    0,
  );

  /** Index of the last activity in each work package, by (phase, area, discipline). */
  const lastOf = new Int32Array(packages);
  const phaseMilestones: number[] = [];
  let packageNumber = 0;

  for (let p = 0; p < phases; p++) {
    const phaseCode = `P${pad(p + 1, 2)}`;
    const phaseNode = addWbs(net, root, phaseCode, `Phase ${p + 1}`);
    for (let a = 0; a < areas; a++) {
      const areaCode = `A${pad(a + 1, 3)}`;
      const areaName = `${words.area} ${a + 1}`;
      const areaNode = addWbs(net, phaseNode, areaCode, areaName);
      const areaFirst = net.code.length;
      for (let d = 0; d < disciplines; d++) {
        const [disciplineCode, disciplineName] = words.disciplines[d % words.disciplines.length]!;
        const node = addWbs(net, areaNode, disciplineCode!, disciplineName!);
        const size = baseSize + (packageNumber < extra ? 1 : 0);
        const packageCalendar = random() < 0.15 ? 1 : 0;
        const first = net.code.length;

        for (let j = 0; j < size; j++) {
          const continuous = random() < 0.03;
          const calendar = continuous ? 2 : packageCalendar;
          const dayMinutes = calendars[calendar]!.dayMinutes;
          const days = continuous
            ? 1 + Math.floor(random() * 7)
            : 1 + Math.floor(random() * random() * 15);
          const verb = continuous
            ? words.waits[Math.floor(random() * words.waits.length)]!
            : words.verbs[Math.floor(random() * words.verbs.length)]!;
          const object = words.objects[Math.floor(random() * words.objects.length)]!;
          const index = addActivity(
            net,
            `${phaseCode}-${areaCode}-${disciplineCode}-${pad((j + 1) * 10, 4)}`,
            `${verb} ${object}, ${areaName.toLowerCase()}`,
            node,
            calendar,
            TaskType.Task,
            days * dayMinutes,
          );

          const preds: number[] = [];
          const link = (pred: number, type: number, lag: number) => {
            if (preds.includes(pred)) return;
            preds.push(pred);
            addRelationship(net, pred, index, type, lag);
          };
          const lagDays = (pred: number, count: number) =>
            count * calendars[net.calendar[pred]!]!.dayMinutes;

          if (j === 0) {
            if (d > 0) {
              link(lastOf[packageNumber - 1]!, RelType.FS, 0);
            } else {
              link(start, RelType.FS, 0);
              if (p > 0) {
                const previous = ((p - 1) * areas + Math.floor(random() * areas)) * disciplines;
                link(lastOf[previous]!, RelType.FS, 0);
              }
            }
          } else {
            // Mostly a chain, with some parallel strands.
            const pred = j >= 3 && random() < 0.4 ? index - 3 : index - 1;
            const kind = random();
            if (kind < 0.9) {
              const roll = random();
              const lag =
                roll < 0.03
                  ? lagDays(pred, 1 + Math.floor(random() * 5))
                  : roll < 0.035
                    ? -lagDays(pred, 1 + Math.floor(random() * 2))
                    : 0;
              link(pred, RelType.FS, lag);
            } else if (kind < 0.96) {
              link(pred, RelType.SS, lagDays(pred, 1 + Math.floor(random() * 3)));
            } else {
              link(pred, RelType.FF, lagDays(pred, Math.floor(random() * 3)));
            }
            if (j >= 2 && random() < 0.12) link(index - 2, RelType.FS, 0);
            // An occasional link to nearby earlier work in the same area. Kept local on
            // purpose: links across areas would chain the whole phase into one long line.
            if (random() < 0.04) {
              const other = index - 2 - Math.floor(random() * 60);
              if (other >= areaFirst) link(other, RelType.FS, 0);
            }
            // Tie the strands together at the end of the package.
            if (j === size - 1) {
              for (let back = 1; back <= 3 && j - back >= 0; back++)
                link(index - back, RelType.FS, 0);
            }
          }
        }
        lastOf[packageNumber] = size > 0 ? net.code.length - 1 : first - 1;
        packageNumber++;
      }
    }
    const milestone = addActivity(
      net,
      `MS-${phaseCode}`,
      `Phase ${p + 1} complete`,
      milestoneNode,
      0,
      TaskType.FinishMilestone,
      0,
    );
    for (let a = 0; a < areas; a++) {
      addRelationship(
        net,
        lastOf[(p * areas + a) * disciplines + disciplines - 1]!,
        milestone,
        RelType.FS,
        0,
      );
    }
    phaseMilestones.push(milestone);
  }

  net.completion = addActivity(
    net,
    'MS-COMPLETE',
    'Project completion',
    milestoneNode,
    0,
    TaskType.FinishMilestone,
    0,
  );
  for (const milestone of phaseMilestones)
    addRelationship(net, milestone, net.completion, RelType.FS, 0);
  return net;
}

/** A copy that can be changed without touching the original. Calendars are shared; they never change. */
export function cloneNetwork(net: Network): Network {
  return {
    ...net,
    code: net.code.slice(),
    name: net.name.slice(),
    wbs: net.wbs.slice(),
    calendar: net.calendar.slice(),
    type: net.type.slice(),
    duration: net.duration.slice(),
    constraintType: net.constraintType.slice(),
    constraintDate: net.constraintDate.slice(),
    removed: net.removed.slice(),
    relPred: net.relPred.slice(),
    relSucc: net.relSucc.slice(),
    relType: net.relType.slice(),
    relLag: net.relLag.slice(),
    relRemoved: net.relRemoved.slice(),
  };
}
