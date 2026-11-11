import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button.tsx';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Choose a file' },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {};
export const Primary: Story = { args: { variant: 'primary', children: 'Compare updates' } };
export const Quiet: Story = { args: { variant: 'quiet', children: 'Cancel' } };
export const Disabled: Story = {
  args: { variant: 'primary', disabled: true, children: 'Compare updates' },
};
