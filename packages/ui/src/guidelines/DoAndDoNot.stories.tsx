import type { Meta, StoryObj } from '@storybook/react-vite';
import { DoAndDoNotPage } from './Pages.tsx';

/** A written page: guidance, not a component. */
const meta: Meta = { title: 'Guidelines/Do and do not' };
export default meta;

export const DoAndDoNot: StoryObj = { name: 'Do and do not', render: () => <DoAndDoNotPage /> };
