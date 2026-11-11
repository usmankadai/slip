import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeltaCell } from './DeltaCell.tsx';

const meta: Meta<typeof DeltaCell> = { title: 'Components/DeltaCell', component: DeltaCell };
export default meta;

type Story = StoryObj<typeof DeltaCell>;

export const Later: Story = { args: { days: 27 } };
export const LaterBeyondTheScale: Story = { args: { days: 67 } };
export const SmallMove: Story = { args: { days: 2 } };
export const PartOfADay: Story = { args: { days: 2.5 } };
export const Earlier: Story = { args: { days: -10 } };
export const EarlierBeyondTheScale: Story = { args: { days: -51 } };
export const NoMove: Story = { args: { days: 0 } };
export const NothingToCompare: Story = { args: { days: null } };
