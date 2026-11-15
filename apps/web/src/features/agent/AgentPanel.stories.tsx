import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EditsController } from '../../app/useEdits.ts';
import { AgentPanel } from './AgentPanel.tsx';
import type { Answer } from './loop.ts';
import { SUGGESTED } from './scripted.ts';

const noop = () => {};
const edits: EditsController = {
  version: 0,
  count: 0,
  approve: () => Promise.reject(new globalThis.Error('Stories do not change schedules.')),
  reject: noop,
  undo: () => Promise.resolve(''),
  undoAll: () => Promise.resolve(),
};

const answer = (over: Partial<Answer>): Answer => ({
  question: SUGGESTED[0]!.text,
  status: 'done',
  steps: [
    { tool: 'diff_summary', input: '', result: '544 changed', isError: false },
    { tool: 'trace_slip', input: 'MS-COMPLETE', result: '4 causes', isError: false },
  ],
  text: 'Project completion #MS-COMPLETE moved 67 working days later, from 7 May 2027 to 10 August 2027. The largest cause was Install catenary, section 2 #P03-A002-ENB-0110 (duration grew, +20d), then Tamp track #P03-A002-TRK-0710 (+18d).',
  known: ['MS-COMPLETE', 'P03-A002-ENB-0110'],
  proposals: [],
  scripted: true,
  elapsedMs: 1400,
  error: '',
  ...over,
});

const meta: Meta<typeof AgentPanel> = {
  title: 'Screens/Agent panel',
  component: AgentPanel,
  parameters: { layout: 'fullscreen' },
  args: {
    answers: [answer({})],
    suggested: SUGGESTED,
    scripted: true,
    working: false,
    onAsk: noop,
    onStop: noop,
    onOpenActivity: noop,
    onClose: noop,
    edits,
    decisions: {},
    onDecision: noop,
  },
};
export default meta;

type Story = StoryObj<typeof AgentPanel>;

export const Populated: Story = {};

export const Loading: Story = {
  args: {
    working: true,
    answers: [answer({ status: 'working', steps: [], text: '', elapsedMs: 0 })],
  },
};

export const Empty: Story = { args: { answers: [] } };

export const EmptyFreeQuestion: Story = {
  args: {
    answers: [
      answer({
        question: 'Is the delay the subcontractor’s fault?',
        steps: [],
        known: [],
        text: 'The scripted assistant answers only the suggested questions. It does not read free questions: that needs the live assistant, which is off on this site.',
      }),
    ],
  },
};

export const Error: Story = {
  args: {
    answers: [
      answer({
        scripted: false,
        status: 'error',
        text: '',
        error: 'The assistant is busy or has reached its limit for now.',
      }),
    ],
  },
};
