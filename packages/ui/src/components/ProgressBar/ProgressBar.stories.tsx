import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './ProgressBar.tsx';

const meta: Meta<typeof ProgressBar> = { title: 'Components/ProgressBar', component: ProgressBar };
export default meta;

type Story = StoryObj<typeof ProgressBar>;

export const PartWay: Story = {
  args: { value: 61, max: 84, label: 'Reading: 252,000 rows · 61 of 84 MB' },
};
export const Starting: Story = { args: { value: 0, max: 86, label: 'Starting: 0 of 86 MB' } };
export const Complete: Story = {
  args: { value: 84, max: 84, label: 'Saving a copy for next time: 84 of 84 MB' },
};
export const TotalNotKnown: Story = { args: { label: 'Generating a sample pair' } };
