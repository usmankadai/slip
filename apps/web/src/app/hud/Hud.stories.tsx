import type { Meta, StoryObj } from '@storybook/react-vite';
import { Hud } from './Hud.tsx';

const meta: Meta<typeof Hud> = {
  title: 'App/Performance HUD',
  component: Hud,
  args: {
    onClose: () => {},
    values: {
      activitiesA: 350_412,
      activitiesB: 350_350,
      p50: 8.3,
      p95: 9.1,
      roundTrip: { type: 'rows', ms: 12.4 },
      heapBytes: 24_000_000,
      engineBytes: 110_000_000,
    },
  },
};
export default meta;

type Story = StoryObj<typeof Hud>;

export const Populated: Story = {};
/** Before anything is loaded, in a browser that does not report its heap. */
export const NothingYet: Story = {
  args: {
    values: {
      activitiesA: null,
      activitiesB: null,
      p50: null,
      p95: null,
      roundTrip: null,
      heapBytes: null,
      engineBytes: 0,
    },
  },
};
