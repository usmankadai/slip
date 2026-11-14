import type { Meta, StoryObj } from '@storybook/react-vite';
import type { HealthSummary } from '@slip/engine';
import { HealthView } from './HealthView.tsx';
import { compareHealth } from './model.ts';

const DAY = 24 * 60;
const JUNE = 9_649 * DAY;

const share = (id: number, name: string, value: number, count: number): HealthSummary => ({
  id,
  name,
  value,
  unit: 'percent',
  threshold: 5,
  limit: 'max',
  pass: value <= 5,
  count,
  population: 20_000,
});
const none = (id: number, name: string, count: number): HealthSummary => ({
  id,
  name,
  value: count,
  unit: 'count',
  threshold: 0,
  limit: 'max',
  pass: count === 0,
  count,
  population: 20_000,
});
const index = (id: number, name: string, value: number): HealthSummary => ({
  id,
  name,
  value,
  unit: 'ratio',
  threshold: 0.95,
  limit: 'min',
  pass: value >= 0.95,
  count: 0,
  population: 0,
});
const reported = (id: number, name: string, count: number, note: string): HealthSummary => ({
  id,
  name,
  value: count || null,
  unit: 'count',
  threshold: null,
  limit: null,
  pass: null,
  count,
  population: 20_000,
  note,
});

/** Made-up figures for the 14 checks, with the engine's real names and thresholds. */
function checks(hard: number, negative: number, missing: number, cpli: number): HealthSummary[] {
  return [
    share(1, 'Missing logic', missing, Math.round(missing * 200)),
    none(2, 'Leads', 0),
    share(3, 'Lags', 2.1, 420),
    {
      ...share(4, 'Relationship types', 94, 1200),
      threshold: 90,
      limit: 'min',
      pass: true,
      note: 'The value is the share of relationships that are finish to start. The count is the rest.',
    },
    share(5, 'Hard constraints', hard, Math.round(hard * 200)),
    share(6, 'High float', 18.2, 3640),
    none(7, 'Negative float', negative),
    share(8, 'High duration', 1.2, 240),
    none(9, 'Invalid dates', 0),
    reported(
      10,
      'Resources',
      0,
      'Resource assignments are not read from the file yet, so this is not assessed.',
    ),
    share(11, 'Missed tasks', 3.4, 68),
    reported(
      12,
      'Critical path test',
      932,
      'Reported only: the number of unfinished activities with total float of zero or less. The full DCMA test (delay an activity and see the finish move by the same amount) is not run.',
    ),
    index(13, 'Critical path length index', cpli),
    index(14, 'Baseline execution index', 0.97),
  ];
}

const A = checks(4.1, 286, 5.4, 0.99);
const noop = () => {};
const meta: Meta<typeof HealthView> = {
  title: 'Screens/Health',
  component: HealthView,
  parameters: { layout: 'fullscreen' },
  args: {
    projectName: 'Northern Rail Upgrade, Phase 2',
    dataDateA: JUNE,
    dataDateB: JUNE + 30 * DAY,
    state: { status: 'ready', health: compareHealth(A, checks(6.3, 622, 4.8, 0.99)) },
    onRetry: noop,
    onBack: noop,
    onActivities: noop,
  },
};
export default meta;

type Story = StoryObj<typeof HealthView>;

export const Populated: Story = {};

export const OnlyWorse: Story = {
  args: { state: { status: 'ready', health: compareHealth(A, checks(6.3, 622, 5.4, 0.91)) } },
};

export const EmptyNothingChanged: Story = {
  args: { state: { status: 'ready', health: compareHealth(A, A) } },
};

export const Loading: Story = { args: { state: { status: 'loading' } } };

export const Error: Story = {
  args: { state: { status: 'error', message: 'Something went wrong while running the checks.' } },
};
