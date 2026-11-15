import { useState } from 'react';
import { Dialog } from '@slip/ui';
import { WhereDataGoes } from '../features/dataflow/WhereDataGoes.tsx';
import { ASSISTANT_MODE } from '../features/agent/mode.ts';
import styles from './Footer.module.css';
import { buildLink, footerLinks, type BuildInfo } from './footerLinks.ts';

const BUILD: BuildInfo = {
  commit: __BUILD_COMMIT__,
  storybookUrl: import.meta.env.VITE_STORYBOOK_URL ?? '',
};

/**
 * Where your data goes, where to find the source, the design system and the published numbers,
 * and which build this is.
 */
export function Footer() {
  const build = buildLink(BUILD);
  const [dataFlow, setDataFlow] = useState(false);
  return (
    <footer className={styles.footer}>
      <nav aria-label="About Slip" className={styles.links}>
        <button type="button" className={styles.open} onClick={() => setDataFlow(true)}>
          Where your data goes
        </button>
        {footerLinks(BUILD).map((link) => (
          <a key={link.label} href={link.href} rel="noreferrer">
            {link.label}
          </a>
        ))}
      </nav>
      {build ? (
        <a className={styles.build} href={build.href} rel="noreferrer">
          {build.label}
        </a>
      ) : (
        <span className={styles.build}>Local build</span>
      )}
      <Dialog open={dataFlow} onClose={() => setDataFlow(false)} title="Where your data goes">
        <WhereDataGoes mode={ASSISTANT_MODE} />
      </Dialog>
    </footer>
  );
}
