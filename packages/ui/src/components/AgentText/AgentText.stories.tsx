import type { Meta, StoryObj } from '@storybook/react-vite';
import { AgentText } from './AgentText.tsx';

const meta: Meta<typeof AgentText> = {
  title: 'Components/AgentText',
  component: AgentText,
  args: { onOpen: () => {} },
};
export default meta;

type Story = StoryObj<typeof AgentText>;

export const Grounded: Story = {
  args: {
    parts: [
      { kind: 'text', text: 'Project completion ' },
      { kind: 'verified', text: 'MS-COMPLETE' },
      {
        kind: 'text',
        text: ' moved 67 working days later, mostly because catenary installation grew by 20 days ',
      },
      { kind: 'verified', text: 'P03-A002-ENB-0110' },
      { kind: 'text', text: '.' },
    ],
  },
};

export const WithAnUnverifiedCode: Story = {
  args: {
    parts: [
      { kind: 'text', text: 'Then track tamping, +18 days ' },
      { kind: 'unverified', text: 'P03-A002-TRK-0710' },
      { kind: 'text', text: '.' },
    ],
  },
};
