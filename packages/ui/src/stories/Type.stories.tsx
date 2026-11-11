import type { Meta, StoryObj } from '@storybook/react-vite';
import styles from './stories.module.css';
import { TokenValue } from './Swatch.tsx';

const SIZES = [
  ['xs', 'Secondary labels only. The floor'],
  ['sm', 'Grid body, compact'],
  ['base', 'Grid body, comfortable. Body text'],
  ['md', 'Panel titles'],
  ['lg', 'Section headings'],
  ['xl', 'Screen titles'],
] as const;

function Type() {
  return (
    <div className={styles.page}>
      <p className={styles.lead}>
        Inter for the interface, JetBrains Mono for activity codes. Both are served by Slip itself.
        Numbers are tabular and zeros are slashed, so a column of dates lines up and a code is never
        misread.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Token</th>
            <th className={styles.num}>Size</th>
            <th className={styles.num}>Line height</th>
            <th>Sample</th>
            <th>Use</th>
          </tr>
        </thead>
        <tbody>
          {SIZES.map(([size, use]) => (
            <tr key={size}>
              <td className={styles.mono}>--text-{size}</td>
              <td className={styles.num}>
                <TokenValue token={`--text-${size}`} />
              </td>
              <td className={styles.num}>
                <TokenValue token={`--leading-${size}`} />
              </td>
              <td style={{ fontSize: `var(--text-${size})`, lineHeight: `var(--leading-${size})` }}>
                Commission catenary, section 5
              </td>
              <td>{use}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className={styles.group}>
        <h2 className={styles.heading}>Codes and numbers</h2>
        <table className={styles.table}>
          <tbody>
            <tr>
              <td>Activity code, mono</td>
              <td className={styles.mono}>P01-A001-TRK-0060 O0 l1I</td>
            </tr>
            <tr>
              <td>Tabular figures</td>
              <td className={styles.num}>
                1,111.10d
                <br />
                8,808.80d
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

const meta: Meta<typeof Type> = { title: 'Foundations/Type', component: Type };
export default meta;

export const Scale: StoryObj<typeof Type> = {};
