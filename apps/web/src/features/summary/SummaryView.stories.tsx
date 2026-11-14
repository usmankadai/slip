import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  LOADING_STATE,
  milestoneList,
  type ChangeCounts,
  type HealthDelta,
  type MilestoneRow,
  type SummaryState,
} from './model.ts';
import { SummaryView } from './SummaryView.tsx';

const DAY = 24 * 60;
const JUNE = 9_649 * DAY;
const at = (days: number) => JUNE + days * DAY;

const ROWS: MilestoneRow[] = [
  { code: 'MS-COMPLETE', name: 'Contract completion', was: at(340), now: at(435), days: 67 },
  { code: 'MS-S3-HO', name: 'Section 3 handover', was: at(256), now: at(295), days: 27 },
  { code: 'MS-S5-EN', name: 'Energisation, section 5', was: at(186), now: at(200), days: 10 },
  { code: 'MS-POS-4', name: 'Track possession 4', was: at(130), now: at(134), days: 2 },
  { code: 'MS-DEPOT', name: 'Depot access', was: at(81), now: at(67), days: -10 },
];
const later = ROWS.filter((row) => row.days > 0);
const earlier = ROWS.filter((row) => row.days < 0);

const COUNTS: ChangeCounts = {
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
};
const HEALTH: HealthDelta = {
  worse: 2,
  better: 1,
  failing: 4,
  assessed: 13,
  worst: 'Hard constraints, 12 more than in update A',
};

const ready = <T,>(value: T) => ({ status: 'ready' as const, value });
const POPULATED: SummaryState = {
  milestones: ready(milestoneList(later, earlier, 5, 42)),
  changes: ready(COUNTS),
  health: ready(HEALTH),
  latestFinish: '',
  recalculation: '',
};

const noop = () => {};
const meta: Meta<typeof SummaryView> = {
  title: 'Screens/Update summary',
  component: SummaryView,
  parameters: { layout: 'fullscreen' },
  args: {
    projectName: 'Northern Rail Upgrade, Phase 2',
    dataDateA: JUNE,
    dataDateB: JUNE + 30 * DAY,
    notices: [],
    state: POPULATED,
    onRetry: noop,
    onBack: noop,
    onChanges: noop,
    onTrace: noop,
    onHealth: noop,
    onNarrative: noop,
    onAudit: noop,
  },
};
export default meta;

type Story = StoryObj<typeof SummaryView>;

export const Populated: Story = {};

export const Loading: Story = { args: { state: LOADING_STATE } };

export const LoadingInParts: Story = {
  args: { state: { ...LOADING_STATE, changes: ready(COUNTS) } },
};

export const EmptyNoMilestoneMoved: Story = {
  args: { state: { ...POPULATED, milestones: ready(milestoneList([], [], 0, 42)) } },
};

export const EmptyNothingChanged: Story = {
  args: {
    state: {
      ...POPULATED,
      milestones: ready(milestoneList([], [], 0, 42)),
      changes: ready({
        ...COUNTS,
        datesMoved: 0,
        durationChanged: 0,
        logicChanged: 0,
        constraintChanged: 0,
        progressed: 0,
        added: 0,
        removed: 0,
        joinedCritical: 0,
        leftCritical: 0,
      }),
    },
  },
};

export const EmptyNoMilestones: Story = {
  args: {
    state: {
      ...POPULATED,
      milestones: ready(milestoneList([], [], 0, 0)),
      latestFinish: 'The latest finish moved from 7 May 2027 to 10 August 2027.',
    },
  },
};

export const Error: Story = {
  args: {
    state: {
      ...POPULATED,
      milestones: {
        status: 'error',
        message:
          'There was not enough memory to compare the two updates. Closing other tabs may help.',
      },
      health: { status: 'error', message: 'Something went wrong while comparing the two updates.' },
    },
  },
};

export const ManyMilestones: Story = {
  args: {
    state: {
      ...POPULATED,
      milestones: ready(
        milestoneList(
          Array.from({ length: 20 }, (_, i) => ({
            code: `MS-${String(i + 1).padStart(3, '0')}`,
            name: `Section ${i + 1} handover`,
            was: at(200 + i),
            now: at(290 + i - i * 2),
            days: 67 - i * 2,
          })),
          earlier,
          412,
          3_180,
        ),
      ),
    },
  },
};

export const CarriedFromImport: Story = {
  args: {
    notices: [
      'Update B is incomplete: the file stopped early and some of it is missing. Dates below may differ from P6.',
      '136 import warnings in update B may change dates.',
    ],
    state: {
      ...POPULATED,
      recalculation:
        "Slip's own calculation gives a different finish for 1,204 activities in update B. This summary uses the dates stored in the files.",
    },
  },
};

export const WithApprovedChanges: Story = {
  args: { edits: { count: 1, onUndoAll: noop } },
};
