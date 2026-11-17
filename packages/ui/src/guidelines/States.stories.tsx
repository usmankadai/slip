import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatesPage } from './Pages.tsx';

/** A written page: guidance, not a component. */
const meta: Meta = { title: 'Guidelines/States' };
export default meta;

export const States: StoryObj = { name: 'States', render: () => <StatesPage /> };
