import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBar, tabId, tabPanelId } from './TabBar.tsx';

const TABS = [
  { value: 'changed', label: 'What changed' },
  { value: 'logic', label: 'Logic', note: '3 in, 2 out' },
  { value: 'everything', label: 'Everything' },
] as const;
type Value = (typeof TABS)[number]['value'];

function Example({ start }: { start: Value }) {
  const [value, setValue] = useState<Value>(start);
  return (
    <div>
      <TabBar label="Activity" tabs={TABS} value={value} onChange={setValue} idPrefix="story" />
      <div role="tabpanel" id={tabPanelId('story', value)} aria-labelledby={tabId('story', value)}>
        <p>The {TABS.find((tab) => tab.value === value)?.label.toLowerCase()} tab.</p>
      </div>
    </div>
  );
}

const meta: Meta<typeof Example> = { title: 'Components/TabBar', component: Example };
export default meta;

type Story = StoryObj<typeof Example>;

export const FirstChosen: Story = { args: { start: 'changed' } };
export const WithNoteChosen: Story = { args: { start: 'logic' } };
