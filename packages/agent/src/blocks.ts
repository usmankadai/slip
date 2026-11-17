/**
 * The shapes an answer may take on screen (agent API spec: a small allow-list, never HTML):
 * paragraphs, bulleted or numbered lists, and tables, with **bold** text and checked citations.
 * Anything else the model writes, including any HTML, stays as the plain text it is. Pure.
 */
import { splitCitations, type TextPart } from './citations.ts';

export interface InlinePart extends TextPart {
  /** Written between ** and **. */
  strong?: boolean;
}

export type AnswerBlock =
  | { kind: 'paragraph'; parts: InlinePart[] }
  | { kind: 'list'; ordered: boolean; items: InlinePart[][] }
  | {
      kind: 'table';
      head: InlinePart[][];
      rows: InlinePart[][][];
      /** Per column. Numbers are right aligned, as everywhere in Slip. */
      align: ('left' | 'right')[];
    };

/** The most rows a table shows; the model is told to keep lists short, and the panel is narrow. */
const MAX_ROWS = 50;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?\b/g;

/**
 * Dates as Slip writes them everywhere else: "7 May 2027", and "7 May 2027, 17:00" when a time is
 * given. The tools hand dates to the model as "2027-05-07 17:00", and it tends to repeat them so.
 * Anything that is not a real calendar date is left as written.
 */
export function readableDates(text: string): string {
  return text.replace(
    ISO_DATE,
    (whole, y: string, m: string, d: string, hh?: string, mm?: string) => {
      const month = Number(m);
      const day = Number(d);
      if (month < 1 || month > 12 || day < 1 || day > 31) return whole;
      const time = hh !== undefined && Number(hh) < 24 && Number(mm) < 60 ? `, ${hh}:${mm}` : '';
      return `${day} ${MONTHS[month - 1]} ${y}${time}`;
    },
  );
}

/** One line of text as parts: bold runs, and citations inside them. Backticks are dropped. */
export function inline(text: string, known: ReadonlySet<string>): InlinePart[] {
  const parts: InlinePart[] = [];
  const pieces = text.replace(/`([^`]*)`/g, '$1').split(/\*\*(.+?)\*\*/g);
  pieces.forEach((piece, index) => {
    if (piece === '') return;
    const strong = index % 2 === 1;
    for (const found of splitCitations(piece, known)) {
      // Dates are rewritten in text only; a citation is an activity code and stays as written.
      const part = found.kind === 'text' ? { ...found, text: readableDates(found.text) } : found;
      parts.push(strong ? { ...part, strong } : part);
    }
  });
  return parts;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
const isSeparator = (line: string) =>
  /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());
/**
 * A number as an answer writes it: a sign, digits with commas, a decimal part, and a unit such
 * as d, %, days or working days. "+18", "−3d", "7.0%", "1,204", "65 working days".
 */
const NUMBER = /^[+\-−]?\d[\d,]*(\.\d+)?\s?(d|%|days?|working days?|wd|h|hours?|MB)?$/i;

/**
 * How each column lines up: as the separator row says when it says (`---:`), otherwise right
 * when every filled cell below the header is a number.
 */
export function columnAlign(separator: string, rows: readonly string[][], width: number) {
  const marks = cells(separator);
  return Array.from({ length: width }, (_, column): 'left' | 'right' => {
    const mark = marks[column] ?? '';
    if (/^:-+:$/.test(mark) || /^-+:$/.test(mark)) return 'right';
    if (/^:-+$/.test(mark)) return 'left';
    const filled = rows
      .map((row) => (row[column] ?? '').replace(/\*\*/g, '').trim())
      .filter(Boolean);
    return filled.length > 0 && filled.every((cell) => NUMBER.test(cell)) ? 'right' : 'left';
  });
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

export function answerBlocks(text: string, known: ReadonlySet<string>): AnswerBlock[] {
  const lines = text.split('\n');
  const blocks: AnswerBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', parts: inline(paragraph.join(' '), known) });
      paragraph = [];
    }
  };

  for (let k = 0; k < lines.length; k++) {
    const line = lines[k]!;
    // A table: a row of cells, then a separator row, then more rows.
    if (line.trim().startsWith('|') && k + 1 < lines.length && isSeparator(lines[k + 1]!)) {
      flush();
      const headCells = cells(line);
      const separator = lines[k + 1]!;
      const raw: string[][] = [];
      k += 2;
      while (k < lines.length && lines[k]!.trim().startsWith('|')) {
        if (raw.length < MAX_ROWS) raw.push(cells(lines[k]!));
        k++;
      }
      k--;
      blocks.push({
        kind: 'table',
        head: headCells.map((cell) => inline(cell, known)),
        rows: raw.map((row) => row.map((cell) => inline(cell, known))),
        align: columnAlign(separator, raw, headCells.length),
      });
      continue;
    }
    const bullet = BULLET.exec(line) ?? NUMBERED.exec(line);
    if (bullet) {
      flush();
      const ordered = NUMBERED.test(line);
      const items: InlinePart[][] = [];
      while (k < lines.length) {
        const item = (ordered ? NUMBERED : BULLET).exec(lines[k]!);
        if (!item) break;
        items.push(inline(item[1]!, known));
        k++;
      }
      k--;
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: 'paragraph', parts: inline(`**${heading[1]!}**`, known) });
      continue;
    }
    if (line.trim() === '') flush();
    else paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

/** Every part of the answer, in order, for counting citations. */
export function partsOf(blocks: readonly AnswerBlock[]): InlinePart[] {
  return blocks.flatMap((block) =>
    block.kind === 'paragraph'
      ? block.parts
      : block.kind === 'list'
        ? block.items.flat()
        : [...block.head.flat(), ...block.rows.flat(2)],
  );
}
