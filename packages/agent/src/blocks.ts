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
  | { kind: 'table'; head: InlinePart[][]; rows: InlinePart[][][] };

/** The most rows a table shows; the model is told to keep lists short, and the panel is narrow. */
const MAX_ROWS = 50;

/** One line of text as parts: bold runs, and citations inside them. Backticks are dropped. */
export function inline(text: string, known: ReadonlySet<string>): InlinePart[] {
  const parts: InlinePart[] = [];
  const pieces = text.replace(/`([^`]*)`/g, '$1').split(/\*\*(.+?)\*\*/g);
  pieces.forEach((piece, index) => {
    if (piece === '') return;
    const strong = index % 2 === 1;
    for (const part of splitCitations(piece, known))
      parts.push(strong ? { ...part, strong } : part);
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
      const head = cells(line).map((cell) => inline(cell, known));
      const rows: InlinePart[][][] = [];
      k += 2;
      while (k < lines.length && lines[k]!.trim().startsWith('|')) {
        if (rows.length < MAX_ROWS) rows.push(cells(lines[k]!).map((cell) => inline(cell, known)));
        k++;
      }
      k--;
      blocks.push({ kind: 'table', head, rows });
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
