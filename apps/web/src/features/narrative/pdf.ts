/**
 * The narrative as a PDF (decision D25): A4, text only, in the three Helvetica fonts every PDF
 * reader has, so nothing is embedded and no library is needed. Loaded only when the planner
 * exports. Pure: blocks in, bytes out.
 *
 * Every piece of text, from the schedule or the planner, goes into the file as an escaped PDF
 * string, so nothing in it can end a string or add an instruction to the page.
 */
import { longDate } from '../../shared/format.ts';
import { evidenceLabel, markOf, type Block } from './model.ts';

/** Characters 128 to 159 of WinAnsiEncoding, the PDF character set these fonts use. */
const WIN_ANSI_HIGH: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

/** A character's byte in WinAnsiEncoding, or -1 when the fonts cannot show it. */
export function winAnsi(code: number): number {
  if (code >= 0x20 && code <= 0x7e) return code;
  if (code >= 0xa0 && code <= 0xff) return code;
  return WIN_ANSI_HIGH[code] ?? -1;
}

/** Helvetica advance widths for ASCII 32 to 126, in thousandths of the font size (its AFM). */
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
/** Bold is wider; this is an upper bound over the bold AFM, so a bold line never runs over. */
const BOLD_FACTOR = 1.12;

type Font = 'regular' | 'bold' | 'italic';
const FONT_NAME: Record<Font, string> = { regular: 'F1', bold: 'F2', italic: 'F3' };

/** How wide text is in points. Characters outside ASCII are counted as wide as a digit. */
export function textWidth(text: string, size: number, font: Font = 'regular'): number {
  let units = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    units += code >= 32 && code <= 126 ? HELVETICA[code - 32]! : 556;
  }
  return (units / 1000) * size * (font === 'bold' ? BOLD_FACTOR : 1);
}

/** Breaks text into lines no wider than `width`, at spaces; a word longer than a line is cut. */
export function wrap(text: string, width: number, size: number, font: Font = 'regular'): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size, font) <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      // A word wider than the line on its own is cut into pieces that fit.
      let rest = word;
      while (textWidth(rest, size, font) > width) {
        let cut = rest.length - 1;
        while (cut > 1 && textWidth(rest.slice(0, cut), size, font) > width) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Text as the inside of a PDF string: backslash, brackets and anything outside printable ASCII
 * are escaped, so the text cannot close the string. Counts characters the fonts cannot show,
 * which become a question mark.
 */
export function pdfString(text: string, missing: { count: number }): string {
  let out = '';
  for (const char of text) {
    const byte = winAnsi(char.codePointAt(0)!);
    if (byte < 0) {
      missing.count++;
      out += '?';
    } else if (byte === 0x5c || byte === 0x28 || byte === 0x29) {
      out += `\\${String.fromCharCode(byte)}`;
    } else if (byte > 0x7e) {
      out += `\\${byte.toString(8).padStart(3, '0')}`;
    } else {
      out += String.fromCharCode(byte);
    }
  }
  return out;
}

const PAGE = { width: 595.28, height: 841.89, margin: 56 };
const TEXT_WIDTH = PAGE.width - 2 * PAGE.margin;

interface Line {
  text: string;
  font: Font;
  size: number;
  /** Space above this line, in points. */
  gap: number;
}

export interface PdfResult {
  bytes: Uint8Array;
  pages: number;
  /** Characters the PDF's fonts cannot show, written as a question mark. */
  replaced: number;
}

/** The narrative as a PDF file. */
export function toPdf(
  projectName: string,
  dataDateA: number,
  dataDateB: number,
  blocks: readonly Block[],
): PdfResult {
  const lines: Line[] = [];
  const add = (text: string, font: Font, size: number, gap: number) =>
    wrap(text, TEXT_WIDTH, size, font).forEach((line, k) =>
      lines.push({ text: line, font, size, gap: k === 0 ? gap : 0 }),
    );
  add(`${projectName || 'Project with no name'}: update narrative`, 'bold', 16, 0);
  add(
    `Updates of ${longDate(dataDateA)} and ${longDate(dataDateB)}. Written by Slip from the two schedule files by template; paragraphs edited or added by hand are marked.`,
    'regular',
    9,
    6,
  );
  for (const block of blocks) {
    if (block.text.trim() === '') continue;
    add(block.title, 'bold', 12, 18);
    add(block.text.trim(), 'regular', 10.5, 4);
    if (block.evidence.length > 0) {
      add(`Evidence: ${block.evidence.map(evidenceLabel).join(', ')}`, 'italic', 9, 4);
    }
    const mark = markOf(block);
    if (mark === 'edited')
      add('Edited by hand. The evidence is for the generated text.', 'italic', 9, 2);
    if (mark === 'own') add("The planner's own statement. No evidence attached.", 'italic', 9, 2);
  }

  // Lay the lines out down the pages, leaving room for the page number at the foot.
  const bottom = PAGE.margin + 24;
  const pages: Line[][] = [[]];
  const at: number[][] = [[]];
  let y = PAGE.height - PAGE.margin;
  for (const line of lines) {
    const height = line.gap + line.size * 1.35;
    if (y - height < bottom && pages.at(-1)!.length > 0) {
      pages.push([]);
      at.push([]);
      y = PAGE.height - PAGE.margin;
    }
    y -= pages.at(-1)!.length === 0 ? line.size : height;
    pages.at(-1)!.push(line);
    at.at(-1)!.push(y);
  }

  const missing = { count: 0 };
  const streams = pages.map((page, p) => {
    const ops = page.map(
      (line, k) =>
        `BT /${FONT_NAME[line.font]} ${line.size} Tf ${PAGE.margin} ${at[p]![k]!.toFixed(2)} Td (${pdfString(line.text, missing)}) Tj ET`,
    );
    const foot = `Page ${p + 1} of ${pages.length}`;
    ops.push(
      `BT /F1 8 Tf ${(PAGE.width - PAGE.margin - textWidth(foot, 8)).toFixed(2)} ${PAGE.margin - 8} Td (${foot}) Tj ET`,
    );
    return ops.join('\n');
  });

  // Objects: 1 catalog, 2 page tree, 3 to 5 fonts, then a page and its content for each page.
  const objects: string[] = [];
  const kids = streams.map((_, p) => `${6 + 2 * p} 0 R`).join(' ');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${streams.length} >>`);
  for (const base of ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique']) {
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`);
  }
  streams.forEach((stream, p) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${7 + 2 * p} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  // Every character written is one byte (escapes keep it so), so string length is byte length.
  let body = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  objects.forEach((object, k) => {
    offsets.push(body.length);
    body += `${k + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(body.length);
  for (let k = 0; k < body.length; k++) bytes[k] = body.charCodeAt(k);
  return { bytes, pages: streams.length, replaced: missing.count };
}
