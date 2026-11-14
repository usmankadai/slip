import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScriptedBadge } from './ScriptedBadge.tsx';

const meta: Meta<typeof ScriptedBadge> = {
  title: 'Components/ScriptedBadge',
  component: ScriptedBadge,
};
export default meta;

export const Default: StoryObj<typeof ScriptedBadge> = {};
