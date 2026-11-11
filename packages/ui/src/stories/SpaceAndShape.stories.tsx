import type { Meta, StoryObj } from '@storybook/react-vite';
import styles from './stories.module.css';
import { TokenValue } from './Swatch.tsx';

function SpaceAndShape() {
  return (
    <div className={styles.page}>
      <p className={styles.lead}>
        Space is a 4px scale. Shape is nearly square: a small radius on controls and cards, none in
        the grid. Layers are separated by borders; only floating layers cast a shadow.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Token</th>
            <th className={styles.num}>Value</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => (
            <tr key={step}>
              <td className={styles.mono}>--space-{step}</td>
              <td className={styles.num}>
                <TokenValue token={`--space-${step}`} />
              </td>
              <td>
                <span className={styles.spaceBar} style={{ width: `var(--space-${step})` }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Token</th>
            <th className={styles.num}>Value</th>
            <th>Sample</th>
            <th>Use</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ['--radius-control', 'Buttons, inputs, chips'],
              ['--radius-card', 'Cards, popovers, the drawer'],
              ['--radius-grid', 'The grid and its cells'],
            ] as const
          ).map(([token, use]) => (
            <tr key={token}>
              <td className={styles.mono}>{token}</td>
              <td className={styles.num}>
                <TokenValue token={token} />
              </td>
              <td>
                <span className={styles.shape} style={{ borderRadius: `var(${token})` }} />
              </td>
              <td>{use}</td>
            </tr>
          ))}
          <tr>
            <td className={styles.mono}>--shadow-floating</td>
            <td />
            <td>
              <span className={styles.floating}>Menu</span>
            </td>
            <td>Menus, popovers and the drawer only</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const meta: Meta<typeof SpaceAndShape> = {
  title: 'Foundations/Space and shape',
  component: SpaceAndShape,
};
export default meta;

export const Scale: StoryObj<typeof SpaceAndShape> = {};
