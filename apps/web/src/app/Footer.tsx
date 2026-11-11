import styles from './Footer.module.css';
import { buildLink, footerLinks, type BuildInfo } from './footerLinks.ts';

const BUILD: BuildInfo = {
  commit: __BUILD_COMMIT__,
  storybookUrl: import.meta.env.VITE_STORYBOOK_URL ?? '',
};

/** Where to find the source, the design system and the published numbers, and which build this is. */
export function Footer() {
  const build = buildLink(BUILD);
  return (
    <footer className={styles.footer}>
      <nav aria-label="About Slip" className={styles.links}>
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
    </footer>
  );
}
