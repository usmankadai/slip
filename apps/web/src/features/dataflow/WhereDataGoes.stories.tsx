import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog } from '@slip/ui';
import { WhereDataGoes } from './WhereDataGoes.tsx';

const meta: Meta<typeof WhereDataGoes> = {
  title: 'Screens/Where your data goes',
  component: WhereDataGoes,
  render: (args) => (
    <Dialog open onClose={() => {}} title="Where your data goes">
      <WhereDataGoes {...args} />
    </Dialog>
  ),
};
export default meta;

type Story = StoryObj<typeof WhereDataGoes>;

/** The public site today: the assistant is scripted. */
export const Scripted: Story = { args: { mode: 'scripted' } };
/** Once the live assistant is connected. */
export const Live: Story = { args: { mode: 'live' } };
