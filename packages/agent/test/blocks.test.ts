import { describe, expect, it } from 'vitest';
import { answerBlocks, inline, partsOf } from '../src/blocks.ts';

const known = new Set(['MS-COMPLETE', 'P03-A002-ENB-0110']);

describe('the shapes an answer may take', () => {
  it('reads bold text and checks citations inside it', () => {
    expect(inline('The **largest cause is #P03-A002-ENB-0110** and `#X-1`.', known)).toEqual([
      { kind: 'text', text: 'The ' },
      { kind: 'text', text: 'largest cause is ', strong: true },
      { kind: 'verified', text: 'P03-A002-ENB-0110', strong: true },
      { kind: 'text', text: ' and ' },
      { kind: 'unverified', text: 'X-1' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('joins lines into paragraphs and splits them at blank lines', () => {
    const blocks = answerBlocks('First line\nsame paragraph.\n\nSecond.', known);
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph']);
    expect(partsOf(blocks).map((p) => p.text)).toEqual(['First line same paragraph.', 'Second.']);
  });

  it('reads a table with its header, and leaves out the separator row', () => {
    const blocks = answerBlocks(
      'Seven checks got worse.\n\n| Check | Before | Now |\n|---|---|---:|\n| Missing logic | 14.2% | 14.6% |\n| **Negative float** | 32 | 82 |\n\nAfter.',
      known,
    );
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'table', 'paragraph']);
    const table = blocks[1] as Extract<(typeof blocks)[number], { kind: 'table' }>;
    expect(table.head.map((cell) => cell[0]?.text)).toEqual(['Check', 'Before', 'Now']);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1]![0]).toEqual([{ kind: 'text', text: 'Negative float', strong: true }]);
  });

  it('reads bulleted and numbered lists, and a heading as bold text', () => {
    const blocks = answerBlocks(
      '## Causes\n- one #MS-COMPLETE\n- two\n\n1. first\n2. second',
      known,
    );
    expect(blocks.map((b) => (b.kind === 'list' ? `list ${b.ordered}` : b.kind))).toEqual([
      'paragraph',
      'list false',
      'list true',
    ]);
    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      parts: [{ kind: 'text', text: 'Causes', strong: true }],
    });
    expect(partsOf([blocks[1]!]).some((p) => p.kind === 'verified')).toBe(true);
  });

  it('keeps anything else as the text it is, HTML included', () => {
    const blocks = answerBlocks(
      '<img src=x onerror=alert(1)> [link](https://evil.example) ![i](x)',
      known,
    );
    expect(
      partsOf(blocks)
        .map((p) => p.text)
        .join(''),
    ).toBe('<img src=x onerror=alert(1)> [link](https://evil.example) ![i](x)');
  });

  it('a pipe line without a separator row is not a table', () => {
    expect(answerBlocks('| not | a table |', known).map((b) => b.kind)).toEqual(['paragraph']);
  });

  it('shows at most 50 rows of a table', () => {
    const rows = Array.from({ length: 80 }, (_, k) => `| ${k} |`).join('\n');
    const blocks = answerBlocks(`| N |\n|---|\n${rows}`, known);
    expect((blocks[0] as { rows: unknown[] }).rows).toHaveLength(50);
  });
});
