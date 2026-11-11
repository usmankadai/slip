import type { Meta, StoryObj } from '@storybook/react-vite';
import styles from './stories.module.css';
import { Swatch } from './Swatch.tsx';

const GROUPS: { title: string; tokens: [string, string?][] }[] = [
  {
    title: 'Surfaces',
    tokens: [
      ['--surface-0', 'Base'],
      ['--surface-1', 'Panel, and a hovered grid row'],
      ['--surface-2', 'Header'],
      ['--surface-3', 'Hover on controls. No muted text here'],
    ],
  },
  {
    title: 'Text',
    tokens: [
      ['--text-primary'],
      ['--text-secondary'],
      ['--text-muted', 'Not on surface 3'],
      ['--text-inverse', 'On slip step 5 and the accent'],
    ],
  },
  { title: 'Borders', tokens: [['--border-subtle'], ['--border-strong']] },
  {
    title: 'Accent',
    tokens: [
      ['--accent', 'Selection and primary actions. Never in a data cell or a Gantt bar'],
      ['--focus-ring'],
    ],
  },
];

function Colour() {
  return (
    <div className={styles.page}>
      <p className={styles.lead}>
        A quiet working surface: light, flat and warm. Colour is kept for data, so a warm bar always
        means late. The values and the reasons are in decision D16; the contrast rules are enforced
        by a test on the token file.
      </p>
      {GROUPS.map((group) => (
        <section key={group.title} className={styles.group}>
          <h2 className={styles.heading}>{group.title}</h2>
          <div className={styles.swatches}>
            {group.tokens.map(([token, note]) => (
              <Swatch key={token} token={token} note={note} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const meta: Meta<typeof Colour> = { title: 'Foundations/Colour', component: Colour };
export default meta;

export const Neutrals: StoryObj<typeof Colour> = {};
