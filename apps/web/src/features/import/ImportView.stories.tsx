import type { Meta, StoryObj } from '@storybook/react-vite';
import { ImportView } from './ImportView.tsx';
import { checkPair } from './pair.ts';
import type { ImportState, SlotFacts, SlotState } from './types.ts';
import { buildReport } from './warnings.ts';

const DAY = 24 * 60;
const JUNE = 9_649 * DAY;
const JULY = JUNE + 30 * DAY;

const CLEAN = buildReport([], { activities: 0, relationships: 0, rows: 0 });
const HEAVY = buildReport(
  [
    { kind: 'row-field-count', count: 2412, examples: ['TASK line 118204', 'TASK line 118205'] },
    { kind: 'unknown-task-type', count: 321, examples: ['P01-A001-TRK-0410: TT_WBS2'] },
    { kind: 'duplicate-task-code', count: 143, examples: ['P02-A003-CIV-0160'] },
    { kind: 'relationship-missing-task', count: 96, examples: ['P03-A005-ENB-0200'] },
    { kind: 'missing-calendar', count: 38, examples: ['P01-A001-TRK-0060'] },
  ],
  { activities: 350_412, relationships: 498_864, rows: 2_104_880 },
);

const factsA: SlotFacts = {
  fileName: 'rail-350k-a.xer',
  projectName: 'Northern Rail Upgrade, Phase 2',
  projectId: 1,
  dataDate: JUNE,
  activities: 350_000,
  relationships: 498_112,
  sourceHash: 'aa',
  projects: [],
  incomplete: false,
  incompleteAccepted: false,
  report: CLEAN,
};
const factsB: SlotFacts = {
  ...factsA,
  fileName: 'rail-350k-b.xer',
  dataDate: JULY,
  activities: 350_412,
  relationships: 498_864,
  sourceHash: 'bb',
};

const ready = (facts: SlotFacts): SlotState => ({ status: 'ready', facts });
const pairOf = (a: SlotFacts, b: SlotFacts, matched = 349_870): ImportState['pair'] => ({
  status: 'checked',
  check: checkPair(a, b, matched),
});
const state = (a: SlotState, b: SlotState, pair: ImportState['pair'] = { status: 'absent' }) => ({
  state: { a, b, pair, generating: false },
});

const noop = () => {};
const meta: Meta<typeof ImportView> = {
  title: 'Screens/Import',
  component: ImportView,
  parameters: { layout: 'fullscreen' },
  args: {
    onFile: noop,
    onFiles: noop,
    onCancel: noop,
    onRetry: noop,
    onProject: noop,
    onAcceptIncomplete: noop,
    onSwap: noop,
    onGenerate: noop,
    onCompare: noop,
  },
};
export default meta;

type Story = StoryObj<typeof ImportView>;

export const Empty: Story = { args: state({ status: 'empty' }, { status: 'empty' }) };

export const Loading: Story = {
  args: state(
    {
      status: 'loading',
      fileName: 'rail-350k-a.xer',
      phase: 'parsing',
      rows: 252_000,
      bytesRead: 61_000_000,
      totalBytes: 84_000_000,
    },
    {
      status: 'loading',
      fileName: 'rail-350k-b.xer',
      phase: 'hashing',
      rows: 0,
      bytesRead: 3_000_000,
      totalBytes: 86_000_000,
    },
  ),
};

export const Error: Story = {
  args: state(ready(factsA), {
    status: 'error',
    fileName: 'programme-june.xlsx',
    title: 'This is not an XER file',
    detail:
      'programme-june.xlsx does not start with the ERMHDR line that every P6 export has. Export the schedule from P6 as XER and try again.',
    retry: false,
  }),
};

export const Populated: Story = {
  args: state(ready(factsA), ready(factsB), pairOf(factsA, factsB)),
};

export const PopulatedWithWarnings: Story = {
  args: state(ready(factsA), ready({ ...factsB, report: HEAVY }), pairOf(factsA, factsB)),
};

export const NeedsAnAnswer: Story = {
  args: state(
    ready({
      ...factsA,
      projects: [
        { id: 1, name: 'Northern Rail Upgrade, Phase 2', dataDate: JUNE, planStart: JUNE },
        { id: 2, name: 'Enabling works', dataDate: JUNE, planStart: JUNE },
        { id: 3, name: 'Depot fit-out', dataDate: JUNE - 14 * DAY, planStart: JUNE },
      ],
    }),
    ready({ ...factsB, incomplete: true, relationships: 211_040 }),
    pairOf(factsA, factsB),
  ),
};

export const WrongOrder: Story = {
  args: state(ready(factsB), ready(factsA), pairOf(factsB, factsA)),
};

export const DifferentSchedules: Story = {
  args: state(
    ready(factsA),
    ready({ ...factsB, projectName: 'Depot fit-out' }),
    pairOf(factsA, { ...factsB, projectName: 'Depot fit-out' }, 14_016),
  ),
};

export const SameFileTwice: Story = {
  args: state(ready(factsA), ready(factsA), pairOf(factsA, factsA)),
};
