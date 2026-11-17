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

/** A live answer with a list and a table, as the model writes them. */
export const WithListAndTable: Story = {
  args: {
    blocks: [
      {
        kind: 'paragraph',
        parts: [
          { kind: 'text', text: 'Seven checks got worse. The one that matters most is the ' },
          { kind: 'text', text: 'critical path length index', strong: true },
          { kind: 'text', text: ', which fell from 0.97 to 0.73.' },
        ],
      },
      {
        kind: 'table',
        head: [
          [{ kind: 'text', text: 'Check' }],
          [{ kind: 'text', text: 'Before' }],
          [{ kind: 'text', text: 'Now' }],
        ],
        rows: [
          [
            [{ kind: 'text', text: 'Negative float' }],
            [{ kind: 'text', text: '32' }],
            [{ kind: 'text', text: '82' }],
          ],
          [
            [{ kind: 'text', text: 'Missing logic' }],
            [{ kind: 'text', text: '14.2%' }],
            [{ kind: 'text', text: '14.6%' }],
          ],
        ],
        align: ['left', 'right', 'right'],
      },
      {
        kind: 'list',
        ordered: false,
        items: [
          [
            { kind: 'text', text: 'Excavate track panels ' },
            { kind: 'verified', text: 'P03-A002-ENB-0110' },
            { kind: 'text', text: ', +20 days' },
          ],
          [{ kind: 'text', text: 'Survey catenary, +18 days' }],
        ],
      },
    ],
  },
};
