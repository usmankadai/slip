import { describe, expect, it } from 'vitest';
import type { HealthView } from '../health/model.ts';
import { milestoneList, type ChangeCounts, type MilestoneRow } from '../summary/model.ts';
import {
  escapeMarkdown,
  generateBlocks,
  markOf,
  ownBlock,
  toMarkdown,
  type Block,
  type NarrativeFacts,
} from './model.ts';

const DAY = 24 * 60;
// 1 June 2026 at midnight, in minutes since 1 January 2000.
const JUNE = 9648 * DAY;
const row = (code: string, name: string, days: number): MilestoneRow => ({
  code,
  name,
  was: JUNE + 300 * DAY,
  now: JUNE + (300 + days) * DAY,
  days,
});
const COUNTS: ChangeCounts = {
  datesMoved: 239,
  durationChanged: 9,
  logicChanged: 39,
  constraintChanged: 0,
  progressed: 105,
  added: 2,
  removed: 2,
  activities: 1000,
  joinedCritical: 18,
  leftCritical: 0,
};
const checkRow = (id: number, name: string, was: string, now: string) => ({
  id,
  name,
  counts: '',
  rule: '',
  note: '',
  was,
  now,
  passes: false,
  movement: 'worse' as const,
  change: '',
  hasOffenders: true,
});
const HEALTH: HealthView = {
  worse: [checkRow(7, 'Negative float', '286', '622')],
  better: [],
  rest: [],
  failing: 4,
  compared: 12,
};

function facts(over: Partial<NarrativeFacts> = {}): NarrativeFacts {
  const rows = [
    row('MS-COMPLETE', 'Project completion', 67),
    row('MS-P03', 'Phase 3 complete', 67),
  ];
  return {
    dataDateA: JUNE,
    dataDateB: JUNE + 27 * DAY,
    milestones: milestoneList(rows, [], 2, 5),
    largest: {
      name: 'Project completion',
      code: 'MS-COMPLETE',
      days: 67,
      causes: [
        {
          activity: 1,
          code: 'ENB-0110',
          name: 'Install catenary',
          what: ['Duration grew'],
          days: 20,
          share: 0.3,
        },
        {
          activity: 2,
          code: 'TRK-0170',
          name: 'Tamp track',
          what: ['Duration grew'],
          days: 18,
          share: 0.27,
        },
        {
          activity: 3,
          code: 'CIV-0220',
          name: 'Backfill wall',
          what: ['Taking longer'],
          days: 16,
          share: 0.24,
        },
        {
          activity: 4,
          code: 'CIV-0040',
          name: 'Excavate cutting',
          what: [],
          days: 13,
          share: 0.19,
        },
      ],
    },
    changes: COUNTS,
    health: HEALTH,
    ...over,
  };
}

describe('generateBlocks', () => {
  const blocks = generateBlocks(facts());
  const byId = (id: string) => blocks.find((block) => block.id === id)!;

  it('writes four blocks in report order', () => {
    expect(blocks.map((block) => block.id)).toEqual(['dates', 'causes', 'changes', 'health']);
    expect(blocks.every((block) => markOf(block) === 'generated')).toBe(true);
  });

  it('leads with the milestones that moved, with dates and evidence', () => {
    expect(byId('dates').text).toBe(
      '2 milestones moved between the updates of 1 June 2026 and 28 June 2026. Project completion moved 67 working days later, from 28 March 2027 to 3 June 2027. The next largest move was Phase 3 complete (+67d).',
    );
    expect(byId('dates').evidence).toEqual([
      { type: 'activity', code: 'MS-COMPLETE' },
      { type: 'activity', code: 'MS-P03' },
    ]);
  });

  it('names the three largest causes and cites them', () => {
    const block = byId('causes');
    expect(block.title).toBe('Why Project completion moved');
    expect(block.text).toContain('because of 4 activities on its driving path');
    expect(block.text).toContain(
      'The largest were Install catenary (duration grew, +20d), Tamp track (duration grew, +18d) and Backfill wall (taking longer, +16d).',
    );
    expect(block.evidence.map((item) => (item.type === 'activity' ? item.code : ''))).toEqual([
      'MS-COMPLETE',
      'ENB-0110',
      'TRK-0170',
      'CIV-0220',
    ]);
  });

  it('says what was recovered as well as what was added', () => {
    const recovered = facts().largest!;
    const block = generateBlocks(
      facts({
        largest: {
          ...recovered,
          causes: [
            ...recovered.causes,
            {
              activity: 9,
              code: 'TRK-0050',
              name: 'Lay sleepers',
              what: [],
              days: -12,
              share: null,
            },
          ],
        },
      }),
    ).find((b) => b.id === 'causes')!;
    expect(block.text).toContain('Lay sleepers recovered 12 working days.');
  });

  it('lists only the kinds of change that happened, each with a chip', () => {
    const block = byId('changes');
    expect(block.text).toBe(
      'Between the two updates, 239 activities had dates move, 9 changed duration, 39 had logic changes and 105 progressed. 2 activities were added and 2 removed, out of 1,000 activities in the current update. 18 activities joined the critical path and 0 left it.',
    );
    expect(block.evidence.map((item) => (item.type === 'change' ? item.kind : ''))).toEqual([
      'dates',
      'durations',
      'logic',
      'progress',
      'added',
    ]);
  });

  it('names the checks that got worse and cites them', () => {
    expect(byId('health').text).toBe(
      '1 DCMA check got worse: Negative float (286 to 622). 4 checks fail in the current update.',
    );
    expect(byId('health').evidence).toEqual([{ type: 'check', id: 7, name: 'Negative float' }]);
  });

  it('says plainly when nothing moved, and leaves out what it cannot say', () => {
    const quiet = generateBlocks(
      facts({
        milestones: milestoneList([], [], 0, 5),
        largest: null,
        changes: {
          ...COUNTS,
          datesMoved: 0,
          durationChanged: 0,
          logicChanged: 0,
          progressed: 0,
          added: 0,
          removed: 0,
          joinedCritical: 0,
        },
        health: { ...HEALTH, worse: [], compared: 12 },
      }),
    );
    expect(quiet.map((block) => block.id)).toEqual(['dates', 'changes', 'health']);
    expect(quiet[0]!.text).toContain('No milestone moved');
    expect(quiet[1]!.text).toBe('Nothing changed between the two updates.');
    expect(quiet[2]!.text).toBe(
      'No DCMA check got worse or better. 4 checks fail in the current update.',
    );
  });

  it('leaves out key dates for a schedule with no milestones, and health that cannot be compared', () => {
    const none = generateBlocks(
      facts({
        milestones: milestoneList([], [], 0, 0),
        largest: null,
        health: { ...HEALTH, compared: 0 },
      }),
    );
    expect(none.map((block) => block.id)).toEqual(['changes']);
  });
});

describe('marks', () => {
  const block: Block = {
    id: 'x',
    title: 'Key dates',
    generated: 'A moved.',
    text: 'A moved.',
    evidence: [],
    source: 'generated',
  };

  it('tells generated, edited and own apart, ignoring surrounding space', () => {
    expect(markOf(block)).toBe('generated');
    expect(markOf({ ...block, text: '  A moved.\n' })).toBe('generated');
    expect(markOf({ ...block, text: 'A moved, but we expect to recover.' })).toBe('edited');
    expect(markOf(ownBlock('own-1'))).toBe('own');
  });
});

describe('Markdown export', () => {
  it('escapes anything that could become a link, an image or HTML', () => {
    expect(escapeMarkdown('[click](javascript:x) <img src=x> *bold* `code`')).toBe(
      '\\[click\\](javascript:x) \\<img src=x\\> \\*bold\\* \\`code\\`',
    );
    expect(escapeMarkdown('# not a heading\n- not a list\n1. not a list')).toBe(
      '\\# not a heading\n\\- not a list\n\\1. not a list',
    );
  });

  it('writes each block with its evidence and its mark', () => {
    const blocks = generateBlocks(facts());
    blocks[1] = { ...blocks[1]!, text: `${blocks[1]!.text} We expect to recover this.` };
    blocks.push({ ...ownBlock('own-1'), text: 'Possession 4 is confirmed.' });
    blocks.push(ownBlock('own-2'));
    const markdown = toMarkdown('Northern <Rail>', JUNE, JUNE + 27 * DAY, blocks);
    expect(markdown.startsWith('# Northern \\<Rail\\>: update narrative\n')).toBe(true);
    expect(markdown).toContain('*Evidence: MS-COMPLETE, MS-P03*');
    expect(markdown).toContain('*Evidence: Negative float (check 7)*');
    expect(markdown).toContain(
      '*Evidence: MS-COMPLETE, ENB-0110, TRK-0170, CIV-0220*\n\n*Edited by hand. The evidence is for the generated text.*',
    );
    expect(markdown).toContain(
      "Possession 4 is confirmed.\n\n*The planner's own statement. No evidence attached.*",
    );
    // An empty paragraph of the planner's own is left out.
    expect(markdown.match(/## Your note/g)).toHaveLength(1);
  });
});
