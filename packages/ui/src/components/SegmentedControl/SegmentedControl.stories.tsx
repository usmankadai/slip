import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl } from './SegmentedControl.tsx';

const meta: Meta = { title: 'Components/SegmentedControl' };
export default meta;

function Density() {
  const [value, setValue] = useState('compact');
  return (
    <SegmentedControl
      label="Density"
      value={value}
      onChange={setValue}
      options={[
        { value: 'compact', label: 'Compact' },
        { value: 'comfortable', label: 'Comfortable' },
      ]}
    />
  );
}

function Kinds() {
  const [value, setValue] = useState('all');
  return (
    <SegmentedControl
      label="Show"
      value={value}
      onChange={setValue}
      options={[
        { value: 'all', label: 'All changes' },
        { value: 'dates', label: 'Dates' },
        { value: 'durations', label: 'Durations' },
        { value: 'logic', label: 'Logic' },
        { value: 'added', label: 'Added' },
        { value: 'everything', label: 'All activities' },
      ]}
    />
  );
}

export const TwoOptions: StoryObj = { render: () => <Density /> };
export const ManyOptions: StoryObj = { render: () => <Kinds /> };
