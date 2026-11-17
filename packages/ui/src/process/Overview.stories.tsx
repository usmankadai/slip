import type { Meta, StoryObj } from '@storybook/react-vite';
import { IdentityPage, LayoutsPage, OverviewPage } from './ProcessPage.tsx';

/** How Slip was designed, the screen layouts and the colour values. Pages, not components. */
const meta: Meta = { title: 'Design process/About' };
export default meta;

type Story = StoryObj;

export const Overview: Story = { name: 'How it was designed', render: () => <OverviewPage /> };
export const ScreenLayouts: Story = { name: 'Screen layouts', render: () => <LayoutsPage /> };
export const VisualIdentity: Story = { name: 'Visual identity', render: () => <IdentityPage /> };
