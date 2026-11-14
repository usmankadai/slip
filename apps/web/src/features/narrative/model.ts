/**
 * The Finish update narrative (layout B: paragraph blocks, each with its own
 * evidence). Generated from the results the other screens show, by templates.
 * Pure: no engine calls, no DOM.
 */
import type { ChangeKind } from '../changes/model.ts';
import type { HealthView } from '../health/model.ts';
import type { ChangeCounts, MilestoneList } from '../summary/model.ts';
import type { Cause } from '../trace/model.ts';
import { count, longDate, plural } from '../../shared/format.ts';

/** What a block's claims rest on. Each opens the changes grid in one click. */
export type Evidence =
  | { type: 'activity'; code: string }
  | { type: 'change'; kind: ChangeKind; label: string }
  | { type: 'check'; id: number; name: string };

export interface Block {
  id: string;
  title: string;
  /** The generated text, kept so an edited block can go back to it. '' for the planner's own. */
  generated: string;
  /** What the block says now. */
  text: string;
  evidence: Evidence[];
  /** 'own' is a paragraph the planner added. */
  source: 'generated' | 'own';
}

export type BlockMark = 'generated' | 'edited' | 'own';

export function markOf(block: Block): BlockMark {
  if (block.source === 'own') return 'own';
  return block.text.trim() === block.generated.trim() ? 'generated' : 'edited';
}

export interface NarrativeFacts {
  dataDateA: number;
  dataDateB: number;
  milestones: MilestoneList;
  /** The trace of the milestone that moved furthest later, or null when none moved later. */
  largest: { name: string; code: string; days: number; causes: Cause[] } | null;
  changes: ChangeCounts;
  health: HealthView;
}

/** "67 working days", "1 working day", "2.5 working days". */
function workingDays(days: number): string {
  const size = Math.round(Math.abs(days) * 10) / 10;
  return `${size.toLocaleString('en-GB', { maximumFractionDigits: 1 })} working ${size === 1 ? 'day' : 'days'}`;
}

function signed(days: number): string {
  const size = Math.round(Math.abs(days) * 10) / 10;
  return `${days > 0 ? '+' : '−'}${size.toLocaleString('en-GB', { maximumFractionDigits: 1 })}d`;
}

function later(days: number): string {
  return `${workingDays(days)} ${days > 0 ? 'later' : 'earlier'}`;
}

/** "a, b and c". */
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function keyDates(facts: NarrativeFacts): Block | null {
  const { milestones, dataDateA, dataDateB } = facts;
  if (milestones.total === 0) return null;
  const period = `between the updates of ${longDate(dataDateA)} and ${longDate(dataDateB)}`;
  if (milestones.moved === 0) {
    const text = `No milestone moved ${period}. All ${plural(milestones.total, 'milestone')} finish when they did in the last update.`;
    return {
      id: 'dates',
      title: 'Key dates',
      generated: text,
      text,
      evidence: [],
      source: 'generated',
    };
  }
  const [first, ...rest] = milestones.rows;
  const sentences = [`${plural(milestones.moved, 'milestone')} moved ${period}.`];
  if (first) {
    sentences.push(
      `${first.name} moved ${later(first.days)}, from ${longDate(first.was)} to ${longDate(first.now)}.`,
    );
  }
  const next = rest.slice(0, 3);
  if (next.length > 0) {
    sentences.push(
      `The next largest ${next.length === 1 ? 'move was' : 'moves were'} ${list(next.map((row) => `${row.name} (${signed(row.days)})`))}.`,
    );
  }
  const text = sentences.join(' ');
  return {
    id: 'dates',
    title: 'Key dates',
    generated: text,
    text,
    evidence: milestones.rows.slice(0, 4).map((row) => ({ type: 'activity', code: row.code })),
    source: 'generated',
  };
}

function causes(facts: NarrativeFacts): Block | null {
  const trace = facts.largest;
  if (!trace || trace.causes.length === 0) return null;
  const added = trace.causes.filter((cause) => cause.days > 0).slice(0, 3);
  const recovered = trace.causes.filter((cause) => cause.days < 0).slice(0, 2);
  const sentences = [
    `${trace.name} moved ${later(trace.days)} because of ${plural(trace.causes.length, 'activity', 'activities')} on its driving path that added time of their own.`,
  ];
  if (added.length > 0) {
    sentences.push(
      `The largest ${added.length === 1 ? 'was' : 'were'} ${list(
        added.map(
          (cause) =>
            `${cause.name} (${cause.what[0] ? `${lower(cause.what[0])}, ` : ''}${signed(cause.days)})`,
        ),
      )}.`,
    );
  }
  if (recovered.length > 0) {
    sentences.push(
      `${list(recovered.map((cause) => `${cause.name} recovered ${workingDays(cause.days)}`))}.`,
    );
  }
  const text = sentences.join(' ');
  return {
    id: 'causes',
    title: `Why ${trace.name} moved`,
    generated: text,
    text,
    evidence: [
      { type: 'activity', code: trace.code },
      ...[...added, ...recovered].map((cause): Evidence => ({
        type: 'activity',
        code: cause.code,
      })),
    ],
    source: 'generated',
  };
}

const CHANGE_PHRASES: {
  key: keyof ChangeCounts;
  kind: ChangeKind | null;
  label: string;
  phrase: (n: number) => string;
}[] = [
  {
    key: 'datesMoved',
    kind: 'dates',
    label: 'Dates moved',
    phrase: (n) => `${plural(n, 'activity', 'activities')} had dates move`,
  },
  {
    key: 'durationChanged',
    kind: 'durations',
    label: 'Durations',
    phrase: (n) => `${count(n)} changed duration`,
  },
  {
    key: 'logicChanged',
    kind: 'logic',
    label: 'Logic',
    phrase: (n) => `${count(n)} had logic changes`,
  },
  {
    key: 'constraintChanged',
    kind: 'constraints',
    label: 'Constraints',
    phrase: (n) => `${count(n)} had constraint changes`,
  },
  {
    key: 'progressed',
    kind: 'progress',
    label: 'Progress',
    phrase: (n) => `${count(n)} progressed`,
  },
];

function changes(facts: NarrativeFacts): Block {
  const c = facts.changes;
  const parts = CHANGE_PHRASES.filter((line) => c[line.key] > 0);
  const sentences: string[] = [];
  if (parts.length > 0)
    sentences.push(
      `Between the two updates, ${list(parts.map((line) => line.phrase(c[line.key])))}.`,
    );
  const addedRemoved = [
    c.added > 0 ? `${plural(c.added, 'activity was', 'activities were')} added` : '',
    c.removed > 0 ? `${count(c.removed)} removed` : '',
  ].filter(Boolean);
  if (addedRemoved.length > 0)
    sentences.push(
      `${list(addedRemoved)}, out of ${plural(c.activities, 'activity', 'activities')} in the current update.`,
    );
  if (c.joinedCritical > 0 || c.leftCritical > 0) {
    sentences.push(
      `${plural(c.joinedCritical, 'activity', 'activities')} joined the critical path and ${count(c.leftCritical)} left it.`,
    );
  }
  const text =
    sentences.length > 0 ? sentences.join(' ') : 'Nothing changed between the two updates.';
  const evidence: Evidence[] = parts
    .filter((line) => line.kind)
    .map((line) => ({ type: 'change', kind: line.kind!, label: line.label }));
  if (c.added > 0) evidence.push({ type: 'change', kind: 'added', label: 'Added' });
  return {
    id: 'changes',
    title: 'What changed',
    generated: text,
    text,
    evidence,
    source: 'generated',
  };
}

function health(facts: NarrativeFacts): Block | null {
  const h = facts.health;
  if (h.compared === 0) return null;
  const describe = (rows: HealthView['worse']) =>
    list(rows.map((row) => `${row.name} (${row.was} to ${row.now})`));
  const sentences: string[] = [];
  if (h.worse.length === 0 && h.better.length === 0) {
    sentences.push(
      `No DCMA check got worse or better. ${plural(h.failing, 'check fails', 'checks fail')} in the current update.`,
    );
  } else {
    if (h.worse.length > 0)
      sentences.push(`${plural(h.worse.length, 'DCMA check')} got worse: ${describe(h.worse)}.`);
    if (h.better.length > 0)
      sentences.push(`${plural(h.better.length, 'check')} got better: ${describe(h.better)}.`);
    sentences.push(`${plural(h.failing, 'check fails', 'checks fail')} in the current update.`);
  }
  const text = sentences.join(' ');
  return {
    id: 'health',
    title: 'Schedule health',
    generated: text,
    text,
    evidence: [...h.worse, ...h.better].map((row) => ({
      type: 'check',
      id: row.id,
      name: row.name,
    })),
    source: 'generated',
  };
}

/** The generated blocks, in report order. A block with nothing to say is left out. */
export function generateBlocks(facts: NarrativeFacts): Block[] {
  return [keyDates(facts), causes(facts), changes(facts), health(facts)].filter(
    (block): block is Block => block !== null,
  );
}

/** A paragraph the planner adds. It has no evidence, and is marked as theirs. */
export function ownBlock(id: string): Block {
  return { id, title: 'Your note', generated: '', text: '', evidence: [], source: 'own' };
}

/** The words for a piece of evidence, as a chip label and in the export. */
export function evidenceLabel(evidence: Evidence): string {
  if (evidence.type === 'activity') return evidence.code;
  if (evidence.type === 'change') return evidence.label;
  return `${evidence.name} (check ${evidence.id})`;
}

/**
 * Escapes text for Markdown so schedule names and the planner's words come out as written,
 * and nothing in them can become a link, an image or HTML.
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/[\\`*_[\]<>|~]/g, '\\$&')
    .split('\n')
    .map((line) =>
      line.replace(/^(\s*)([#>+-]|\d+\.)/, (_, space: string, mark: string) => `${space}\\${mark}`),
    )
    .join('\n');
}

export function toMarkdown(
  projectName: string,
  dataDateA: number,
  dataDateB: number,
  blocks: readonly Block[],
): string {
  const lines = [
    `# ${escapeMarkdown(projectName || 'Project with no name')}: update narrative`,
    '',
    `Updates of ${longDate(dataDateA)} and ${longDate(dataDateB)}. Written by Slip from the two schedule files by template; paragraphs edited or added by hand are marked.`,
  ];
  for (const block of blocks) {
    if (block.text.trim() === '') continue;
    const mark = markOf(block);
    lines.push('', `## ${escapeMarkdown(block.title)}`, '', escapeMarkdown(block.text.trim()), '');
    // Each note is its own paragraph, so they do not run together when the Markdown is read.
    const notes: string[] = [];
    if (block.evidence.length > 0) {
      notes.push(
        `*Evidence: ${block.evidence.map((item) => escapeMarkdown(evidenceLabel(item))).join(', ')}*`,
      );
    }
    if (mark === 'edited') notes.push('*Edited by hand. The evidence is for the generated text.*');
    if (mark === 'own') notes.push("*The planner's own statement. No evidence attached.*");
    lines.push(notes.join('\n\n'));
  }
  return `${lines.join('\n')}\n`;
}
