import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MentionInput, type MentionList } from './MentionInput.tsx';

const MATCHES = [
  { code: 'P01-A001-TRK-1000', name: 'Install catenary, section 2', slipDays: 67 },
  { code: 'P03-A002-TRK-0170', name: 'Survey catenary, section 2', slipDays: 18 },
  { code: 'P03-A001-TRK-1035', name: 'Commission catenary, section 5', slipDays: 5 },
  { code: 'P02-A001-TRK-0222', name: 'Tension catenary, section 1', slipDays: 2 },
  { code: 'P02-A003-TRK-1049', name: 'Install catenary, section 2', slipDays: 0 },
  { code: 'P01-A004-TRK-0410', name: 'Survey catenary, section 4', slipDays: -3 },
];

function Example({ start, list }: { start: string; list: MentionList | null }) {
  const [value, setValue] = useState(start);
  return (
    // Leaves room above for the list, which opens upwards from a box at the foot of a panel.
    <div style={{ width: 380, paddingTop: 'calc(var(--space-8) * 8)' }}>
      <label htmlFor="story-question" style={{ display: 'block' }}>
        Your question
      </label>
      <MentionInput
        id="story-question"
        rows={2}
        value={value}
        onChange={setValue}
        onSubmit={() => {}}
        onMentionQuery={() => {}}
        list={list}
      />
    </div>
  );
}

const meta: Meta<typeof Example> = { title: 'Components/MentionInput', component: Example };
export default meta;

type Story = StoryObj<typeof Example>;

export const Populated: Story = {
  args: { start: 'Why did #catenary', list: { state: 'ready', options: MATCHES, total: 6 } },
};
export const ManyMatches: Story = {
  args: { start: 'Why did #catenary', list: { state: 'ready', options: MATCHES, total: 1204 } },
};
export const SelectedFirst: Story = {
  args: {
    start: 'Why did #',
    list: {
      state: 'ready',
      options: [{ ...MATCHES[0]!, note: 'Selected in the grid' }],
      total: 1,
    },
  },
};
export const Loading: Story = { args: { start: 'Why did #caten', list: { state: 'loading' } } };
export const Empty: Story = {
  args: { start: 'Why did #catenaryx', list: { state: 'ready', options: [], total: 0 } },
};
export const Error: Story = {
  args: {
    start: 'Why did #catenary',
    list: { state: 'error', message: 'Slip could not search the activities. Try again.' },
  },
};
export const Closed: Story = { args: { start: 'Why did the project slip?', list: null } };
