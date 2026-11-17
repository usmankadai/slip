import type { Meta, StoryObj } from '@storybook/react-vite';
import { IdentityPage } from './Pages.tsx';

/** A written page: guidance, not a component. */
const meta: Meta = { title: 'Guidelines/Identity' };
export default meta;

export const Identity: StoryObj = { name: 'Identity', render: () => <IdentityPage /> };
