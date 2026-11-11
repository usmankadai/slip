import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './Skeleton.tsx';

const meta: Meta<typeof Skeleton> = { title: 'Components/Skeleton', component: Skeleton };
export default meta;

type Story = StoryObj<typeof Skeleton>;

export const Short: Story = { args: { width: 'short' } };
export const Medium: Story = { args: { width: 'medium' } };
export const Long: Story = { args: { width: 'long' } };
