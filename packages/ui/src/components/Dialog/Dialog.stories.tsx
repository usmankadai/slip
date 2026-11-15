import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog } from './Dialog.tsx';

const meta: Meta<typeof Dialog> = {
  title: 'Components/Dialog',
  component: Dialog,
  args: { open: true, onClose: () => {} },
};
export default meta;

type Story = StoryObj<typeof Dialog>;

export const Open: Story = {
  args: {
    title: 'Where your data goes',
    children:
      'Nothing about your schedule leaves this browser. The files are read here and kept in this browser’s storage.',
  },
};

export const LongContent: Story = {
  args: {
    title: 'Where your data goes',
    children: Array.from({ length: 30 }, (_, i) => (
      <p key={i}>
        Paragraph {i + 1}. A dialog taller than the window scrolls inside itself, and the screen
        behind it stays where it was.
      </p>
    )),
  },
};
