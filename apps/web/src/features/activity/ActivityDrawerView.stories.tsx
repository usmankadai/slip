import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActivityDrawerView } from './ActivityDrawerView.tsx';
import type { ActivityModel, FieldRow } from './model.ts';

const field = (label: string, was: string, now: string, change = ''): FieldRow => ({
  label,
  was,
  now,
  change,
  changed: change !== '',
});
const SAME: FieldRow[] = [
  field('Status', 'Not started', 'Not started'),
  field('Activity type', 'Task', 'Task'),
  field('Calendar', '5 day', '5 day'),
  field('WBS', 'Section 2 / OLE', 'Section 2 / OLE'),
  field('Actual start', 'None', 'None'),
  field('Actual finish', 'None', 'None'),
];

const MOVED: ActivityModel = {
  code: 'P01-A001-TRK-1000',
  name: 'Install catenary, section 2',
  slipDays: 67,
  isNew: false,
  critical: 'Now critical',
  fields: [
    field('Finish', '8 May 2027', '11 Aug 2027', '+67d'),
    field('Start', '14 Apr 2027', '3 Jul 2027', '+56d'),
    field('Original duration', '18d', '29d', '+11d'),
    field('Remaining duration', '18d', '29d', '+11d'),
    field('Total float', '12d', '−4d', '−16d'),
    field('Constraint', 'None', 'Finish on or before 30 Jul 2027', 'Added'),
    ...SAME,
  ],
  changedCount: 6,
  linkChanges: [
    {
      side: 'Predecessor',
      change: 'Added',
      code: 'P01-A003-CIV-0410',
      name: 'Piling, mast bases 40 to 62',
      type: 'FS',
      lag: '0d',
    },
    {
      side: 'Predecessor',
      change: 'Removed',
      code: 'P01-A002-DES-0120',
      name: 'OLE design freeze',
      type: 'FS',
      lag: '0d',
    },
  ],
  logicChanged: true,
  predecessors: [
    { code: 'P01-A003-CIV-0410', name: 'Piling, mast bases 40 to 62', type: 'FS', lag: '0d' },
    { code: 'P01-A001-TRK-0990', name: 'Erect masts, section 2', type: 'FS', lag: '0d' },
    { code: 'P01-A001-TRK-0995', name: 'Install registration arms', type: 'SS', lag: '3d' },
  ],
  successors: [
    { code: 'P01-A001-TRK-1010', name: 'Wire run and tension, section 2', type: 'FS', lag: '0d' },
    { code: 'MS-S2-ENERG', name: 'Energisation, section 2', type: 'FS', lag: '5d' },
  ],
  predecessorCount: 3,
  successorCount: 2,
};

const WHY =
  'The largest causes are Piling, mast bases 40 to 62 (new activity, +45d) and this activity (duration grew, +11d). 2 more activities also moved it.';

const meta: Meta<typeof ActivityDrawerView> = {
  title: 'Screens/Activity drawer',
  component: ActivityDrawerView,
  parameters: { layout: 'padded' },
  args: {
    tab: 'changed',
    onTab: () => {},
    onClose: () => {},
    onRetry: () => {},
    onTrace: () => {},
    why: { status: 'ready', sentence: WHY },
    state: { status: 'ready', model: MOVED },
  },
};
export default meta;

type Story = StoryObj<typeof ActivityDrawerView>;

export const Loading: Story = {
  args: { state: { status: 'loading', code: 'P01-A001-TRK-1000' }, why: { status: 'loading' } },
};
/** An activity where nothing changed between the updates. */
export const EmptyNothingChanged: Story = {
  args: {
    state: {
      status: 'ready',
      model: {
        ...MOVED,
        code: 'P02-A004-CIV-2210',
        name: 'Drainage, chainage 14+200 to 14+650',
        slipDays: 0,
        critical: '',
        fields: [
          field('Finish', '19 Feb 2027', '19 Feb 2027'),
          field('Start', '2 Feb 2027', '2 Feb 2027'),
          ...SAME,
        ],
        changedCount: 0,
        linkChanges: [],
        logicChanged: false,
      },
    },
    why: { status: 'ready', sentence: null },
  },
};
export const Error: Story = {
  args: {
    state: {
      status: 'error',
      code: 'P01-A001-TRK-1000',
      message:
        'The engine stopped and the schedules are no longer loaded. Go back to import and load them again.',
    },
  },
};
export const Populated: Story = {};
export const WhyStillTracing: Story = { args: { why: { status: 'loading' } } };
export const LogicTab: Story = { args: { tab: 'logic' } };
export const EverythingTab: Story = { args: { tab: 'everything' } };
export const NewInUpdateB: Story = {
  args: {
    state: {
      status: 'ready',
      model: {
        ...MOVED,
        code: 'P01-A003-CIV-0410',
        name: 'Piling, mast bases 40 to 62',
        slipDays: null,
        isNew: true,
        critical: '',
        fields: MOVED.fields.map((row) => ({ ...row, was: '', change: '', changed: false })),
        changedCount: 0,
        linkChanges: [],
      },
    },
  },
};
/** More links than the engine lists: no one-by-one comparison is claimed. */
export const ManyLinks: Story = {
  args: {
    state: {
      status: 'ready',
      model: { ...MOVED, linkChanges: null, predecessorCount: 46 },
    },
  },
};
