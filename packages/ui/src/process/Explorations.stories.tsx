import type { Meta, StoryObj } from '@storybook/react-vite';
import { EXPLORATIONS } from './process.ts';
import { ExplorationPage } from './ProcessPage.tsx';

/**
 * Each exploration: the options drawn for one hard interaction, what was chosen, and whose
 * reasons the choice rests on. Pages, not components.
 */
const meta: Meta = { title: 'Design process/Explorations' };
export default meta;

type Story = StoryObj;

const exploration = (number: string): Story => {
  const entry = EXPLORATIONS.find((item) => item.number === number)!;
  return {
    name: `${number}. ${entry.title}`,
    render: () => <ExplorationPage exploration={entry} />,
  };
};

export const Exploration01 = exploration('01');
export const Exploration02 = exploration('02');
export const Exploration03 = exploration('03');
export const Exploration04 = exploration('04');
export const Exploration05 = exploration('05');
export const Exploration06 = exploration('06');
export const Exploration07 = exploration('07');
export const Exploration08 = exploration('08');
export const Exploration09 = exploration('09');
export const Exploration10 = exploration('10');
export const Exploration11 = exploration('11');
export const Exploration12 = exploration('12');
