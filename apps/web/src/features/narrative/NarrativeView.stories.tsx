import type { Meta, StoryObj } from '@storybook/react-vite';
import { generateBlocks, ownBlock, type NarrativeFacts } from './model.ts';
import { NarrativeView } from './NarrativeView.tsx';
import { milestoneList } from '../summary/model.ts';

const DAY = 24 * 60;
const JUNE = 9_649 * DAY;

const FACTS: NarrativeFacts = {
  dataDateA: JUNE,
  dataDateB: JUNE + 30 * DAY,
  milestones: milestoneList(
    [
      {
        code: 'MS-COMPLETE',
        name: 'Contract completion',
        was: JUNE + 340 * DAY,
        now: JUNE + 435 * DAY,
        days: 67,
      },
      {
        code: 'MS-S3-HO',
        name: 'Section 3 handover',
        was: JUNE + 256 * DAY,
        now: JUNE + 295 * DAY,
        days: 27,
      },
    ],
    [
      {
        code: 'MS-DEPOT',
        name: 'Depot access',
        was: JUNE + 81 * DAY,
        now: JUNE + 67 * DAY,
        days: -10,
      },
    ],
    3,
    42,
  ),
  largest: {
    name: 'Contract completion',
    code: 'MS-COMPLETE',
    days: 67,
    causes: [
      {
        activity: 1,
        code: 'P03-A002-ENB-0110',
        name: 'Install catenary, section 2',
        what: ['Duration grew'],
        days: 20,
        share: 0.3,
      },
      {
        activity: 2,
        code: 'P03-A002-TRK-0170',
        name: 'Tamp and align track, section 2',
        what: ['Duration grew'],
        days: 18,
        share: 0.27,
      },
      {
        activity: 3,
        code: 'P03-A002-CIV-0220',
        name: 'Backfill retaining wall, section 2',
        what: ['Taking longer'],
        days: 16,
        share: 0.24,
      },
    ],
  },
  changes: {
    datesMoved: 4812,
    durationChanged: 312,
    logicChanged: 96,
    constraintChanged: 12,
    progressed: 2240,
    added: 412,
    removed: 130,
    activities: 350_412,
    joinedCritical: 14,
    leftCritical: 6,
  },
  health: {
    worse: [
      {
        id: 7,
        name: 'Negative float',
        counts: '',
        rule: '',
        note: '',
        was: '286',
        now: '622',
        passes: false,
        movement: 'worse',
        change: '',
        hasOffenders: true,
      },
    ],
    better: [],
    rest: [],
    failing: 4,
    compared: 12,
  },
};

const GENERATED = generateBlocks(FACTS);
const EDITED = [
  {
    ...GENERATED[0]!,
    text: `${GENERATED[0]!.text} We expect to recover most of this when the revised possession plan is agreed.`,
  },
  ...GENERATED.slice(1),
  { ...ownBlock('own-1'), text: 'Possession 4 is confirmed for March.' },
];

const noop = () => {};
const meta: Meta<typeof NarrativeView> = {
  title: 'Screens/Finish update',
  component: NarrativeView,
  parameters: { layout: 'fullscreen' },
  args: {
    projectName: 'Northern Rail Upgrade, Phase 2',
    dataDateA: JUNE,
    dataDateB: JUNE + 30 * DAY,
    state: { status: 'ready', blocks: GENERATED },
    onChange: noop,
    onRestore: noop,
    onRemove: noop,
    onAdd: noop,
    onExport: noop,
    onEvidence: noop,
    onRetry: noop,
    onBack: noop,
    saved: true,
  },
};
export default meta;

type Story = StoryObj<typeof NarrativeView>;

export const Generated: Story = {};
export const EditedAndOwn: Story = { args: { state: { status: 'ready', blocks: EDITED } } };
export const EmptyNothingMoved: Story = {
  args: {
    state: {
      status: 'ready',
      blocks: generateBlocks({
        ...FACTS,
        milestones: milestoneList([], [], 0, 42),
        largest: null,
        changes: {
          ...FACTS.changes,
          datesMoved: 0,
          durationChanged: 0,
          logicChanged: 0,
          constraintChanged: 0,
          progressed: 0,
          added: 0,
          removed: 0,
          joinedCritical: 0,
          leftCritical: 0,
        },
        health: { ...FACTS.health, worse: [] },
      }),
    },
  },
};
export const NotSaved: Story = { args: { saved: false } };
export const Loading: Story = { args: { state: { status: 'loading' } } };
export const Error: Story = {
  args: {
    state: { status: 'error', message: 'Something went wrong while comparing the two updates.' },
  },
};
