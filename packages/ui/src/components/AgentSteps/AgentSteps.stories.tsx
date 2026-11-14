import type { Meta, StoryObj } from '@storybook/react-vite';
import { AgentSteps } from './AgentSteps.tsx';

const meta: Meta<typeof AgentSteps> = { title: 'Components/AgentSteps', component: AgentSteps };
export default meta;

type Story = StoryObj<typeof AgentSteps>;

const STEPS = [
  { tool: 'diff_summary', input: '', result: '544 changed', isError: false },
  { tool: 'trace_slip', input: 'MS-COMPLETE', result: '4 causes', isError: false },
];

export const Done: Story = { args: { steps: STEPS, seconds: 3 } };
export const Working: Story = { args: { steps: STEPS.slice(0, 1), working: true } };
export const WithAFailedStep: Story = {
  args: {
    steps: [
      ...STEPS,
      { tool: 'get_activity', input: 'X-1', result: 'There is no activity X-1.', isError: true },
    ],
    seconds: 4,
  },
};
