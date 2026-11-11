import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { Notice } from './Notice.tsx';

const meta: Meta<typeof Notice> = { title: 'Components/Notice', component: Notice };
export default meta;

type Story = StoryObj<typeof Notice>;

export const Plain: Story = {
  args: { children: 'Same project, one month apart. 349,870 activities are in both updates.' },
};
export const Attention: Story = {
  args: {
    tone: 'attention',
    children:
      "Update A is the later one: its data date is 1 July 2026 and update B's is 1 June 2026.",
    action: <Button variant="primary">Swap them</Button>,
  },
};
export const WithTitle: Story = {
  args: {
    tone: 'attention',
    title: 'This file is incomplete',
    children:
      'It ends without the closing line P6 writes. Slip read 350,412 activities and 211,040 relationships; some are probably missing.',
    action: (
      <>
        <Button>Choose another file</Button>
        <Button variant="quiet">Use it as it is</Button>
      </>
    ),
  },
};
