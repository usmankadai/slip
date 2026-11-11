import { useLayoutEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import styles from './stories.module.css';

const ROWS = [
  ['P01-A001-TRK-0060', 'Erect ballast, section 1', '7.00d'],
  ['P03-A005-ENB-0200', 'Commission catenary, section 5', '122.00d'],
  ['P02-A003-CIV-0160', 'Pour ballast, section 3', '278.00d'],
] as const;

function Density() {
  return (
    <div className={styles.page}>
      <p className={styles.lead}>
        Two densities, switched with the Density control in the toolbar above. Compact is the
        default: a planner wants as many rows on screen as will stay readable.
      </p>
      <div className={styles.grid}>
        <div className={`${styles.row} ${styles.head}`}>
          <span>Activity code</span>
          <span>Name</span>
          <span className={styles.right}>Total float</span>
        </div>
        {ROWS.map(([code, name, float]) => (
          <div key={code} className={styles.row}>
            <span className={styles.mono}>{code}</span>
            <span>{name}</span>
            <span className={styles.right}>{float}</span>
          </div>
        ))}
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Token</th>
            <th className={styles.num}>Value at this density</th>
          </tr>
        </thead>
        <tbody>
          {['--row-height', '--cell-padding-x', '--grid-text', '--grid-leading'].map((token) => (
            <tr key={token}>
              <td className={styles.mono}>{token}</td>
              <td className={styles.num}>
                <ResolvedSize token={token} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Density tokens are set on a wrapper, not the root, so the value is read where it is used. */
function ResolvedSize({ token }: { token: string }) {
  const probe = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState('');
  useLayoutEffect(() => {
    if (probe.current) setValue(getComputedStyle(probe.current).getPropertyValue(token).trim());
  });
  return <span ref={probe}>{value}</span>;
}

const meta: Meta<typeof Density> = { title: 'Foundations/Density', component: Density };
export default meta;

export const Grid: StoryObj<typeof Density> = {};
