import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AgentSteps,
  AgentText,
  Button,
  ScriptedBadge,
  DeltaCell,
  Dialog,
  EntityChip,
  Notice,
  ProgressBar,
  ProposedEditCard,
  SegmentedControl,
  Skeleton,
  TabBar,
  barLength,
  formatDelta,
} from '../src/index.ts';

describe('Button', () => {
  it('is a button that does not submit a form by default', () => {
    expect(renderToStaticMarkup(<Button>Compare updates</Button>)).toMatch(
      /^<button type="button"[^>]*>Compare updates<\/button>$/,
    );
  });

  it('passes disabled through', () => {
    expect(renderToStaticMarkup(<Button disabled>Compare updates</Button>)).toContain('disabled');
  });
});

describe('ProgressBar', () => {
  it('ties the label to the bar and clamps the value', () => {
    const html = renderToStaticMarkup(
      <ProgressBar value={120} max={84} label="Reading: 84 of 84 MB" />,
    );
    expect(html).toContain('value="84"');
    expect(html).toContain('max="84"');
    const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
  });

  it('is indeterminate when no value is given', () => {
    expect(renderToStaticMarkup(<ProgressBar label="Generating a sample pair" />)).not.toContain(
      'value=',
    );
  });
});

describe('Notice', () => {
  it('is a status by default and an alert when it needs attention', () => {
    expect(renderToStaticMarkup(<Notice>Same project.</Notice>)).toContain('role="status"');
    expect(renderToStaticMarkup(<Notice tone="attention">Wrong order.</Notice>)).toContain(
      'role="alert"',
    );
  });

  it('renders text as text, never as markup', () => {
    expect(renderToStaticMarkup(<Notice>{'<img src=x onerror=alert(1)>'}</Notice>)).toContain(
      '&lt;img',
    );
  });
});

describe('DeltaCell', () => {
  it('writes a signed number of working days with a unit', () => {
    expect(formatDelta(67)).toBe('+67d');
    expect(formatDelta(-10)).toBe('−10d');
    expect(formatDelta(2.5)).toBe('+2.5d');
    expect(formatDelta(1250)).toBe('+1,250d');
    expect(formatDelta(0)).toBe('0d');
    expect(formatDelta(-0.04)).toBe('0d');
  });

  it('keeps the bar on a fixed scale that is full at 40 working days', () => {
    expect(barLength(40)).toBe(50);
    expect(barLength(67)).toBe(50);
    expect(barLength(-400)).toBe(50);
    expect(barLength(10)).toBe(25);
    expect(barLength(0)).toBe(0);
  });

  it('draws later to the right of the centre and earlier to the left', () => {
    expect(renderToStaticMarkup(<DeltaCell days={10} />)).toContain('x="50" y="1" width="25"');
    expect(renderToStaticMarkup(<DeltaCell days={-10} />)).toContain('x="25" y="1" width="25"');
  });

  it('shows the number as text and hides the bar from assistive technology', () => {
    const html = renderToStaticMarkup(<DeltaCell days={67} />);
    expect(html).toContain('>+67d</span>');
    expect(html).toContain('aria-hidden="true"');
  });

  it('is empty when there is nothing to compare, or the value is not a number', () => {
    for (const days of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      const html = renderToStaticMarkup(<DeltaCell days={days} />);
      expect(html).not.toContain('<svg');
      expect(html).not.toContain('d</span>');
    }
  });

  it('draws no bar for no move', () => {
    expect(renderToStaticMarkup(<DeltaCell days={0} />)).not.toContain('y="1"');
  });
});

describe('Skeleton', () => {
  it('is hidden from assistive technology', () => {
    expect(renderToStaticMarkup(<Skeleton />)).toContain('aria-hidden="true"');
  });
});

describe('SegmentedControl', () => {
  it('marks exactly one option as pressed and names the group', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        label="Density"
        value="comfortable"
        onChange={() => {}}
        options={[
          { value: 'compact', label: 'Compact' },
          { value: 'comfortable', label: 'Comfortable' },
        ]}
      />,
    );
    expect(html).toContain('aria-label="Density"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Comfortable/);
  });
});

describe('EntityChip', () => {
  it('is a button that names its evidence, with a description when given', () => {
    const html = renderToStaticMarkup(
      <EntityChip
        kind="activity"
        label="MS-COMPLETE"
        description="Open activity MS-COMPLETE"
        onOpen={() => {}}
      />,
    );
    expect(html).toMatch(/^<button type="button"/);
    expect(html).toContain('aria-label="Open activity MS-COMPLETE"');
    expect(html).toContain('>MS-COMPLETE</button>');
  });

  it('renders a label as text, never as markup', () => {
    expect(renderToStaticMarkup(<EntityChip label="<b>x</b>" onOpen={() => {}} />)).toContain(
      '&lt;b&gt;',
    );
  });
});

describe('AgentSteps', () => {
  const steps = [
    { tool: 'diff_summary', input: '', result: '544 changed', isError: false },
    { tool: 'trace_slip', input: 'MS-COMPLETE', result: '4 causes', isError: false },
  ];

  it('folds the working into one line', () => {
    const html = renderToStaticMarkup(<AgentSteps steps={steps} seconds={2.6} />);
    expect(html).toContain('Worked for 3s, 2 steps');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('trace_slip');
  });

  it('says it is working, and shows nothing for an answer with no steps', () => {
    expect(renderToStaticMarkup(<AgentSteps steps={steps.slice(0, 1)} working />)).toContain(
      'Working, 1 step so far',
    );
    expect(renderToStaticMarkup(<AgentSteps steps={[]} seconds={1} />)).toBe('');
  });
});

describe('AgentText', () => {
  it('draws lists and tables as elements and keeps HTML as text', () => {
    const html = renderToStaticMarkup(
      <AgentText
        onOpen={() => {}}
        blocks={[
          { kind: 'paragraph', parts: [{ kind: 'text', text: '<img src=x onerror=alert(1)>' }] },
          { kind: 'list', ordered: true, items: [[{ kind: 'text', text: 'one', strong: true }]] },
          {
            kind: 'table',
            head: [[{ kind: 'text', text: 'Check' }]],
            rows: [[[{ kind: 'verified', text: 'MS-COMPLETE' }]]],
          },
        ]}
      />,
    );
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img');
    expect(html).toContain('<ol');
    expect(html).toContain('<strong>one</strong>');
    expect(html).toContain('<th scope="col">');
    expect(html).toContain('MS-COMPLETE');
  });

  it('makes verified codes chips and marks unverified ones in words', () => {
    const html = renderToStaticMarkup(
      <AgentText
        onOpen={() => {}}
        parts={[
          { kind: 'text', text: 'See ' },
          { kind: 'verified', text: 'MS-COMPLETE' },
          { kind: 'text', text: ' and ' },
          { kind: 'unverified', text: 'X-1' },
        ]}
      />,
    );
    expect(html).toContain('aria-label="Open activity MS-COMPLETE"');
    expect(html).toContain('X-1</span><span');
    expect(html).toContain('>unverified</span>');
    expect(html).not.toContain('Open activity X-1');
  });

  it('renders answer text as text, never as markup', () => {
    const html = renderToStaticMarkup(
      <AgentText onOpen={() => {}} parts={[{ kind: 'text', text: '<script>x</script>' }]} />,
    );
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('ScriptedBadge', () => {
  it('says the answer is scripted', () => {
    expect(renderToStaticMarkup(<ScriptedBadge />)).toContain('Scripted answer, not AI');
  });
});

describe('ProposedEditCard', () => {
  const props = {
    field: 'Original duration',
    activityName: 'Install catenary',
    activityCode: 'ENB-0110',
    from: '40 working days',
    to: '20 working days',
    reason: 'It grew.',
    effect: {
      milestones: [{ code: 'MS-COMPLETE', days: 36 }],
      milestonesMoved: 3,
      projectFinishBefore: '10 August 2027',
      projectFinishAfter: '1 October 2027',
      activitiesMoved: 1,
      later: true,
    },
    state: 'proposed' as const,
    onApprove: () => {},
    onReject: () => {},
    onUndo: () => {},
  };

  it('says in words when a change makes the finish later, and lists the milestones', () => {
    const html = renderToStaticMarkup(<ProposedEditCard {...props} />);
    expect(html).toContain('This makes the project finish later.');
    expect(html).toContain('MS-COMPLETE');
    expect(html).toContain('+36d');
    expect(html).toContain('2 more milestones move.');
    expect(html).toContain('1 activity changes dates.');
  });

  it('cannot be approved before the effect is known', () => {
    const html = renderToStaticMarkup(<ProposedEditCard {...props} effect={null} />);
    expect(html).toContain('Working out what this would move');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Approve<\/button>/);
  });

  it('stays after a decision, saying what happened, and offers Undo only when approved', () => {
    const approved = renderToStaticMarkup(
      <ProposedEditCard {...props} state="approved" outcome="Approved by you." />,
    );
    expect(approved).toContain('>Approved<');
    expect(approved).toContain('>Undo<');
    expect(approved).not.toContain('>Approve<');
    const rejected = renderToStaticMarkup(
      <ProposedEditCard {...props} state="rejected" outcome="Rejected." />,
    );
    expect(rejected).not.toContain('>Undo<');
  });
});

describe('Dialog', () => {
  const html = renderToStaticMarkup(
    <Dialog open onClose={() => {}} title="Where your data goes">
      Nothing leaves.
    </Dialog>,
  );

  it('is a native dialog named by its title', () => {
    const labelled = /<dialog[^>]*aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(labelled).toBeTruthy();
    expect(html).toContain(`<h2 id="${labelled}"`);
    expect(html).toContain('Where your data goes</h2>');
  });

  it('always has a way to close it', () => {
    expect(html).toMatch(/<button type="button"[^>]*>Close<\/button>/);
    expect(html).toContain('Nothing leaves.');
  });
});

describe('TabBar', () => {
  const html = renderToStaticMarkup(
    <TabBar
      label="Activity"
      idPrefix="d"
      value="logic"
      onChange={() => {}}
      tabs={[
        { value: 'changed', label: 'What changed' },
        { value: 'logic', label: 'Logic', note: '3 in, 2 out' },
      ]}
    />,
  );

  it('is a named tab list with the chosen tab selected and in the tab order', () => {
    expect(html).toContain('role="tablist" aria-label="Activity"');
    expect(html).toMatch(
      /id="d-tab-logic" aria-selected="true" aria-controls="d-panel-logic" tabindex="0"/,
    );
    expect(html).toMatch(
      /id="d-tab-changed" aria-selected="false" aria-controls="d-panel-changed" tabindex="-1"/,
    );
  });

  it('shows a note beside its label', () => {
    expect(html).toContain('Logic<span');
    expect(html).toContain('3 in, 2 out</span>');
  });
});
