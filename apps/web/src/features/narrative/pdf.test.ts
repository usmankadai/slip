import { describe, expect, it } from 'vitest';
import type { Block } from './model.ts';
import { pdfString, textWidth, toPdf, winAnsi, wrap } from './pdf.ts';

const DAY = 24 * 60;
const JUNE = 9_649 * DAY;
const block = (over: Partial<Block> = {}): Block => ({
  id: 'b',
  title: 'Contract completion',
  generated: 'Contract completion moved 67 working days later.',
  text: 'Contract completion moved 67 working days later.',
  evidence: [{ type: 'activity', code: 'MS-COMPLETE' }],
  source: 'generated',
  ...over,
});
const text = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

describe('PDF strings', () => {
  it('escapes what could end a string or start an instruction', () => {
    const missing = { count: 0 };
    expect(pdfString('a (b) \\ c', missing)).toBe('a \\(b\\) \\\\ c');
    expect(pdfString(') Tj ET BT /F1 99 Tf (', missing)).toBe('\\) Tj ET BT /F1 99 Tf \\(');
    expect(missing.count).toBe(0);
  });

  it("writes accented letters and typographic marks in the fonts' character set", () => {
    const missing = { count: 0 };
    expect(pdfString('Détail – café', missing)).toBe('D\\351tail \\226 caf\\351');
    expect(winAnsi(0x2019)).toBe(0x92);
    expect(missing.count).toBe(0);
  });

  it('counts characters the fonts cannot show, and drops control characters', () => {
    const missing = { count: 0 };
    expect(pdfString('Łódź 東京\n', missing)).toBe('?\\363d? ???');
    expect(missing.count).toBe(5);
  });
});

describe('lines', () => {
  it('measures with Helvetica widths', () => {
    expect(textWidth('ii', 10)).toBeCloseTo(4.44);
    expect(textWidth('W', 10, 'bold')).toBeGreaterThan(textWidth('W', 10));
  });

  it('wraps at spaces and keeps every word', () => {
    const lines = wrap('the quick brown fox jumps over the lazy dog', 60, 10);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => textWidth(line, 10) <= 60)).toBe(true);
    expect(lines.join(' ')).toBe('the quick brown fox jumps over the lazy dog');
  });

  it('cuts a word too long for a line', () => {
    const lines = wrap('P01-A001-TRK-1000-P01-A001-TRK-1000-P01-A001-TRK-1000', 80, 10);
    expect(lines.every((line) => textWidth(line, 10) <= 80)).toBe(true);
    expect(lines.join('')).toBe('P01-A001-TRK-1000-P01-A001-TRK-1000-P01-A001-TRK-1000');
  });

  it("keeps the planner's line breaks", () => {
    expect(wrap('one\ntwo', 400, 10)).toEqual(['one', 'two']);
  });
});

describe('the narrative as a PDF', () => {
  it('is a PDF whose cross-reference table points at every object', () => {
    const { bytes, pages } = toPdf('Northern Rail', JUNE, JUNE + 30 * DAY, [block()]);
    const pdf = text(bytes);
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pages).toBe(1);
    const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const offsets = [...pdf.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    );
    offsets.forEach((offset, k) =>
      expect(pdf.slice(offset).startsWith(`${k + 1} 0 obj`)).toBe(true),
    );
    // Each content stream's stated length matches what it holds.
    for (const match of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const start = match.index! + match[0].length;
      expect(pdf.slice(start + Number(match[1]), start + Number(match[1]) + 10)).toBe(
        '\nendstream',
      );
    }
  });

  it('holds the title, the paragraphs, the evidence and the marks', () => {
    const pdf = text(
      toPdf('Northern Rail', JUNE, JUNE + 30 * DAY, [
        block(),
        block({ id: 'e', title: 'Section 3', text: 'Changed by hand.' }),
        block({
          id: 'o',
          title: 'Note',
          generated: '',
          text: 'My own words.',
          evidence: [],
          source: 'own',
        }),
        block({ id: 'x', title: 'Empty', text: '  ' }),
      ]).bytes,
    );
    expect(pdf).toContain('(Northern Rail: update narrative) Tj');
    expect(pdf).toContain('(Evidence: MS-COMPLETE) Tj');
    expect(pdf).toContain('(Edited by hand. The evidence is for the generated text.) Tj');
    expect(pdf).toContain("(The planner's own statement. No evidence attached.) Tj");
    expect(pdf).not.toContain('(Empty) Tj');
    expect(pdf).toContain('(Page 1 of 1) Tj');
  });

  it('runs onto more pages and numbers them', () => {
    const many = Array.from({ length: 40 }, (_, k) =>
      block({ id: `b${k}`, title: `Paragraph ${k + 1}` }),
    );
    const { bytes, pages } = toPdf('Long', JUNE, JUNE, many);
    expect(pages).toBeGreaterThan(1);
    expect(text(bytes)).toContain(`(Page ${pages} of ${pages}) Tj`);
    expect(text(bytes)).toContain(`/Count ${pages}`);
  });

  it('keeps hostile text inside its string and reports characters it could not show', () => {
    const { bytes, replaced } = toPdf(') Tj ET 0 0 m 999 999 l S BT (', JUNE, JUNE, [
      block({ text: '東京 works' }),
    ]);
    const pdf = text(bytes);
    expect(pdf).toContain('(\\) Tj ET 0 0 m 999 999 l S BT \\(: update narrative) Tj');
    expect(replaced).toBe(2);
  });
});
