import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityChip } from './EntityChip.tsx';

const meta: Meta<typeof EntityChip> = {
  title: 'Components/EntityChip',
  component: EntityChip,
  args: { onOpen: () => {} },
};
export default meta;

type Story = StoryObj<typeof EntityChip>;

export const Activity: Story = {
  args: {
    kind: 'activity',
    label: 'P03-A002-ENB-0110',
    description: 'Open activity P03-A002-ENB-0110',
  },
};
export const KindOfChange: Story = { args: { label: 'Logic' } };
export const HealthCheck: Story = { args: { label: 'Negative float (check 7)' } };
