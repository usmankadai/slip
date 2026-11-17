import type { Meta, StoryObj } from '@storybook/react-vite';
import { PrinciplesPage } from './Pages.tsx';

/** A written page: guidance, not a component. */
const meta: Meta = { title: 'Guidelines/Principles' };
export default meta;

export const Principles: StoryObj = { name: 'Principles', render: () => <PrinciplesPage /> };
