import type { Meta, StoryObj } from '@storybook/react-vite';
import styles from './stories.module.css';
import { TokenValue } from './Swatch.tsx';

const BANDS = ['Under 5', '5 to under 10', '10 to under 20', '20 to under 40', '40 or more'];
const EXAMPLES = [3, 7, 14, 26, 67];

function Step({ side, step }: { side: 'late' | 'early'; step: number }) {
  const token = `--slip-${side}-${step}`;
  const sign = side === 'late' ? '+' : '−';
  return (
    <span
      className={styles.step}
      style={{
        background: `var(${token})`,
        color: step === 5 ? 'var(--text-inverse)' : 'var(--text-primary)',
      }}
    >
      {sign}
      {EXAMPLES[step - 1]}d
    </span>
  );
}

function SlipScale() {
  return (
    <div className={styles.page}>
      <p className={styles.lead}>
        Warm means later, blue means earlier, grey means no change. Slip is counted in working days.
        Colour never carries the meaning alone: the sign and the number are always shown.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Step</th>
            <th>Working days</th>
            <th>Late</th>
            <th>Early</th>
            <th>As a fill behind text</th>
            <th>As a bar or glyph</th>
          </tr>
        </thead>
        <tbody>
          {BANDS.map((band, index) => {
            const step = index + 1;
            return (
              <tr key={band}>
                <td className={styles.num}>{step}</td>
                <td>{band}</td>
                <td>
                  <Step side="late" step={step} />
                </td>
                <td>
                  <Step side="early" step={step} />
                </td>
                <td>Yes, with {step === 5 ? 'inverse' : 'primary'} text</td>
                <td>{step >= 4 ? 'Yes' : 'No, too pale against the surface'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className={styles.group}>
        <h2 className={styles.heading}>Other data colours</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Token</th>
              <th>Value</th>
              <th>Sample</th>
              <th>Use</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['--slip-late-text', 'A late value written as text on a surface'],
                ['--slip-early-text', 'An early value written as text on a surface'],
                ['--slip-none', 'No change'],
              ] as const
            ).map(([token, use]) => (
              <tr key={token}>
                <td className={styles.mono}>{token}</td>
                <td className={styles.mono}>
                  <TokenValue token={token} />
                </td>
                <td>
                  <span className={styles.bar} style={{ background: `var(${token})` }} />
                </td>
                <td>{use}</td>
              </tr>
            ))}
            <tr>
              <td className={styles.mono}>--critical</td>
              <td className={styles.mono}>
                <TokenValue token="--critical" />
              </td>
              <td>
                <span className={styles.hatch} />
              </td>
              <td>Critical path. Always with the hatch, since it sits close to late step 5</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

const meta: Meta<typeof SlipScale> = { title: 'Foundations/Slip scale', component: SlipScale };
export default meta;

export const Scale: StoryObj<typeof SlipScale> = {};
