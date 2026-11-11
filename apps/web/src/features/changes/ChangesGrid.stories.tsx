import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Change, type SortSpec } from '@slip/engine';
import { Button, type Density } from '@slip/ui';
import styles from './changes.module.css';
import { ChangesGrid } from './ChangesGrid.tsx';
import { GridMessage } from './GridMessage.tsx';
import { DEFAULT_SORT, nextSort } from './model.ts';
import type { GridRow } from './useGridRows.ts';

const DAY = 24 * 60;
const JUNE = 9_649 * DAY;
const NAMES = [
  'Install catenary, section 2',
  'Tamp and align track, section 2',
  'Backfill retaining wall, section 2',
  'Pour ballast, section 3',
  'Erect ballast, section 1',
  'Commission catenary, section 5',
  'Lay sleepers, section 2',
];
const SLIPS = [67, 27, 20, 18, 16, 5, 2, 0, -3, -10, -46, null];
const FLAGS = [
  Change.FinishMoved | Change.JoinedCriticalPath,
  Change.FinishMoved | Change.DurationChanged,
  Change.LogicChanged,
  Change.Progressed,
  Change.Added,
];

/** Made-up rows, worked out from the row number so a million of them cost nothing. */
function fakeRow(position: number): GridRow {
  const slip = SLIPS[position % SLIPS.length]!;
  return {
    activity: position,
    code: `P0${(position % 3) + 1}-A00${(position % 5) + 1}-TRK-${String(((position * 7) % 9000) + 1000)}`,
    name: NAMES[position % NAMES.length]!,
    was: slip === null ? -2147483648 : JUNE + (position % 200) * DAY,
    now: JUNE + ((position % 200) + (slip ?? 0)) * DAY,
    slipDays: slip,
    float: ((position * 37) % 4000) - 400,
    flags: slip === null ? Change.Added : FLAGS[position % FLAGS.length]!,
  };
}

function Demo({
  total,
  density = 'compact',
  loading = false,
  selected = null,
}: {
  total: number;
  density?: Density;
  loading?: boolean;
  selected?: number | null;
}) {
  const [sort, setSort] = useState<SortSpec | null>(DEFAULT_SORT);
  const [selectedRow, setSelectedRow] = useState<number | null>(selected);
  return (
    <div className={styles.storyFrame}>
      <ChangesGrid
        total={total}
        density={density}
        rowAt={loading ? () => undefined : fakeRow}
        onRows={() => {}}
        onPosition={() => {}}
        sort={sort}
        onSort={(column) => setSort((current) => nextSort(current, column))}
        selectedRow={selectedRow}
        onSelectRow={setSelectedRow}
        reveal={null}
      />
    </div>
  );
}

const meta: Meta = { title: 'Screens/Changes grid', parameters: { layout: 'fullscreen' } };
export default meta;

export const Populated: StoryObj = { render: () => <Demo total={4812} /> };
export const Comfortable: StoryObj = { render: () => <Demo total={4812} density="comfortable" /> };
export const RowSelected: StoryObj = { render: () => <Demo total={4812} selected={3} /> };
export const Loading: StoryObj = { render: () => <Demo total={30} loading /> };
export const AMillionRows: StoryObj = { render: () => <Demo total={1_000_000} /> };
export const FewRows: StoryObj = { render: () => <Demo total={5} /> };

export const Empty: StoryObj = {
  render: () => (
    <div className={styles.storyFrame}>
      <GridMessage
        title="No activity matches"
        body='Nothing in this view has "zzzz" in its code or name.'
        action={<Button>Show all 350,412 activities</Button>}
      />
    </div>
  ),
};

export const Error: StoryObj = {
  render: () => (
    <div className={styles.storyFrame}>
      <GridMessage
        alert
        title="Slip could not read the rows"
        body="Something went wrong while reading the rows."
        action={<Button>Try again</Button>}
      />
    </div>
  ),
};
