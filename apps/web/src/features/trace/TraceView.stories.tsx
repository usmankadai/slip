import type { Meta, StoryObj } from '@storybook/react-vite';
import { TraceEnd } from '@slip/engine';
import { buildTrace, type TraceInput } from './model.ts';
import { TraceView } from './TraceView.tsx';

const DAY = 24 * 60;
const JUNE = 9_649 * DAY;

/** A straight driving path. `own` is what each activity added, earliest first. */
function trace(own: number[], names: string[], end: number = TraceEnd.DataDate): TraceInput {
  const nodes = [1, ...own.map((_, k) => 10 + k).reverse()];
  let running = 0;
  const slipAt = own.map((days) => (running += days));
  return {
    slipWorkingDays: running,
    isNew: false,
    nodes,
    depth: nodes.map((_, k) => k),
    end: nodes.map((_, k) => (k === own.length ? end : TraceEnd.Driven)),
    codes: nodes.map((node) =>
      node === 1 ? 'MS-COMPLETE' : `P03-A002-CIV-${String(node * 10).padStart(4, '0')}`,
    ),
    names: nodes.map((node) =>
      node === 1 ? 'Project completion' : (names[node - 10] ?? 'Activity'),
    ),
    slipDays: [running, ...slipAt.slice().reverse()],
    contributors: own
      .map((days, k) => ({
        activity: 10 + k,
        kind: (days < 0 ? 'progress' : k % 3 === 0 ? 'logic' : 'duration') as
          'progress' | 'logic' | 'duration',
        workingDays: days,
      }))
      .filter((part) => part.workingDays !== 0),
    truncated: false,
  };
}

const NAMES = [
  'Survey formation, section 2',
  'Excavate cutting, section 2',
  'Lay drainage, section 2',
  'Form subgrade, section 2',
  'Backfill retaining wall, section 2',
  'Lay sleepers, section 2',
  'Tamp and align track, section 2',
  'Erect masts, section 2',
  'Install catenary, section 2',
  'Test and commission, section 2',
  'Enter service tests, section 2',
];
const CLEAN = buildTrace(trace([0, 13, 0, 0, 16, 0, 18, 0, 20, 0], NAMES));
const MESSY = buildTrace(trace([0, 24, 2, 0, -12, 1, 15, 1, 9, 1, 0], NAMES, TraceEnd.Constraint));

const noop = () => {};
const meta: Meta<typeof TraceView> = {
  title: 'Screens/Slip trace',
  component: TraceView,
  parameters: { layout: 'fullscreen' },
  args: {
    projectName: 'Northern Rail Upgrade, Phase 2',
    target: {
      code: 'MS-COMPLETE',
      name: 'Project completion',
      was: JUNE + 340 * DAY,
      now: JUNE + 435 * DAY,
    },
    backLabel: 'summary',
    onBack: noop,
    onRetry: noop,
    state: { status: 'ready', trace: CLEAN },
  },
};
export default meta;

type Story = StoryObj<typeof TraceView>;

export const Populated: Story = {};

export const WithARecoveryAndSmallCauses: Story = {
  args: { state: { status: 'ready', trace: MESSY } },
};

export const NotFullyExplained: Story = {
  args: { state: { status: 'ready', trace: { ...CLEAN, slipDays: 74, unexplained: 7 } } },
};

export const ReachedItsLimit: Story = {
  args: { state: { status: 'ready', trace: { ...CLEAN, truncated: true } } },
};

export const Loading: Story = { args: { state: { status: 'loading' } } };

export const EmptyNoSlip: Story = {
  args: { state: { status: 'ready', trace: buildTrace(trace([0, 0, 0], NAMES)) } },
};

export const EmptyNewActivity: Story = { args: { state: { status: 'new' } } };

export const Error: Story = {
  args: {
    state: { status: 'error', message: 'Something went wrong while tracing this activity.' },
  },
};
