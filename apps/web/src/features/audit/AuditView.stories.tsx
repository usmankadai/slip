import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuditView } from './AuditView.tsx';

const DAY = 24 * 60;
const JUNE = 9_649 * DAY;
// 14 November 2026, 09:12 UTC, in milliseconds since 1970.
const NOW = 1_794_647_520_000;
const MINUTE = 60_000;

const meta: Meta<typeof AuditView> = {
  title: 'Screens/Activity log',
  component: AuditView,
  parameters: { layout: 'fullscreen' },
  args: {
    projectName: 'Northern Rail Upgrade, Phase 2',
    dataDateA: JUNE,
    dataDateB: JUNE + 30 * DAY,
    persisted: true,
    onBack: () => {},
    state: {
      status: 'ready',
      entries: [
        {
          id: 5,
          pair: 'p',
          at: NOW + 31 * MINUTE,
          actor: 'user',
          type: 'narrative-exported',
          summary:
            'Exported the narrative as update-narrative-2026-07-01.md: 5 paragraphs, 2 edited or your own.',
        },
        {
          id: 4,
          pair: 'p',
          at: NOW + 24 * MINUTE,
          actor: 'user',
          type: 'narrative-added',
          summary: 'Added a paragraph of your own.',
        },
        {
          id: 3,
          pair: 'p',
          at: NOW + 20 * MINUTE,
          actor: 'user',
          type: 'narrative-edited',
          summary: 'Edited the paragraph "Key dates".',
        },
        {
          id: 2,
          pair: 'p',
          at: NOW + MINUTE,
          actor: 'user',
          type: 'incomplete-used',
          summary: 'Used update B as it is, though the file stopped early.',
        },
        {
          id: 1,
          pair: 'p',
          at: NOW,
          actor: 'user',
          type: 'compared',
          summary:
            'Compared rail-350k-a.xer (350,000 activities) with rail-350k-b.xer (350,412 activities).',
        },
      ],
    },
  },
};
export default meta;

type Story = StoryObj<typeof AuditView>;

export const Populated: Story = {};
export const MayBeCleared: Story = { args: { persisted: false } };
export const Empty: Story = { args: { state: { status: 'ready', entries: [] } } };
export const Loading: Story = { args: { state: { status: 'loading' } } };
export const Error: Story = { args: { state: { status: 'error' } } };
