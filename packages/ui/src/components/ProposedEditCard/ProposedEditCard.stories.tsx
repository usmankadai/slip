import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProposedEditCard } from './ProposedEditCard.tsx';

const noop = () => {};
const meta: Meta<typeof ProposedEditCard> = {
  title: 'Components/ProposedEditCard',
  component: ProposedEditCard,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 388 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    field: 'Original duration',
    activityName: 'Install catenary, section 2',
    activityCode: 'P03-A002-ENB-0110',
    from: '40 working days',
    to: '20 working days',
    reason:
      'Its duration grew by 20 working days this update and that growth drives Project completion.',
    effect: {
      milestones: [
        { code: 'MS-COMPLETE', days: -20 },
        { code: 'MS-P03', days: -20 },
      ],
      milestonesMoved: 2,
      projectFinishBefore: '10 August 2027',
      projectFinishAfter: '13 July 2027',
      activitiesMoved: 212,
      later: false,
    },
    state: 'proposed',
    onApprove: noop,
    onReject: noop,
    onUndo: noop,
    onSeeActivity: noop,
  },
};
export default meta;

type Story = StoryObj<typeof ProposedEditCard>;

export const RecoversTime: Story = {};
export const MakesItWorse: Story = {
  args: {
    field: 'Constraint',
    from: 'None',
    to: 'Start on or after 2 June 2027',
    effect: {
      milestones: [{ code: 'MS-COMPLETE', days: 36 }],
      milestonesMoved: 1,
      projectFinishBefore: '10 August 2027',
      projectFinishAfter: '1 October 2027',
      activitiesMoved: 96,
      later: true,
    },
  },
};
export const MovesNothing: Story = {
  args: {
    effect: {
      milestones: [],
      milestonesMoved: 0,
      projectFinishBefore: '10 August 2027',
      projectFinishAfter: '10 August 2027',
      activitiesMoved: 3,
      later: false,
    },
  },
};
export const WorkingOutTheEffect: Story = { args: { effect: null } };
export const Approved: Story = {
  args: { state: 'approved', outcome: 'Approved by you. The schedule was recalculated.' },
};
export const Rejected: Story = {
  args: { state: 'rejected', outcome: 'Rejected by you. Nothing was changed.' },
};
