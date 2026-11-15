import { describe, expect, it } from 'vitest';
import dataFlow from '../../../../../docs/data-flow.md?raw';
import security from '../../../../../docs/spec/security.md?raw';
import { FLOWS, flowCells, leadSentence, markdownTableAfter } from './flows.ts';

describe('what leaves the browser', () => {
  it('docs/data-flow.md prints the same table as the panel', () => {
    expect(markdownTableAfter(dataFlow, 'In detail')).toEqual(flowCells());
  });

  it('the security spec prints the same table as the panel', () => {
    expect(markdownTableAfter(security, 'What leaves the browser')).toEqual(flowCells());
  });

  it('never says the schedule never leaves without the live-mode qualification', () => {
    expect(leadSentence('live')).toContain('sent through');
    expect(leadSentence('scripted')).toContain('scripted');
    expect(FLOWS.filter((flow) => flow.anthropic !== 'Never').every((f) => f.liveOnly)).toBe(true);
  });
});

describe('reading a Markdown table', () => {
  const doc =
    '# Other\n\n| x |\n|---|\n| 1 |\n\n## Wanted\n\nText.\n\n| A | B |\n| --- | :-: |\n| 1 | 2 |\n\nAfter.\n| 9 | 9 |';

  it('takes the first table after the heading and drops the separator', () => {
    expect(markdownTableAfter(doc, 'Wanted')).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ]);
  });

  it('returns null with no such heading or no table', () => {
    expect(markdownTableAfter(doc, 'Missing')).toBeNull();
    expect(markdownTableAfter('## Wanted\n\nNo table.', 'Wanted')).toBeNull();
  });
});
