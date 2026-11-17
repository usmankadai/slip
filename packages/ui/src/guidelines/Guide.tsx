/** The parts of a written page in Storybook: a header, sections, tables, code and links to stories. */
import type { ReactNode } from 'react';
import styles from './guidelines.module.css';

export function GuidePage({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className={styles.page}>
      <header className={styles.section}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
      </header>
      {children}
    </article>
  );
}

export function GuideSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.heading}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function GuideText({ children, quiet }: { children: ReactNode; quiet?: boolean }) {
  return <p className={quiet ? styles.quiet : styles.text}>{children}</p>;
}

export function GuideList({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/** A table whose first column names each row. Right-aligns the columns listed in `numeric`. */
export function GuideTable({
  caption,
  head,
  rows,
  numeric = [],
}: {
  caption: string;
  head: readonly string[];
  rows: readonly (readonly ReactNode[])[];
  numeric?: readonly number[];
}) {
  return (
    <table className={styles.table}>
      <caption className={styles.hidden}>{caption}</caption>
      <thead>
        <tr>
          {head.map((cell, index) => (
            <th key={index} scope="col" className={numeric.includes(index) ? styles.number : ''}>
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, at) => (
          <tr key={at}>
            {row.map((cell, index) =>
              index === 0 ? (
                <th key={index} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={index} className={numeric.includes(index) ? styles.number : ''}>
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Code shown as text, with a label saying whether to copy it. */
export function GuideCode({
  label,
  code,
  wrong,
}: {
  label: string;
  code: string;
  wrong?: boolean;
}) {
  return (
    <figure className={`${styles.example} ${wrong ? styles.wrong : styles.right}`}>
      <figcaption className={styles.exampleLabel}>{label}</figcaption>
      <pre className={styles.code}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

/** A link to another story, opened in the Storybook around this page. */
export function StoryLink({ story, children }: { story: string; children: ReactNode }) {
  return (
    <a className={styles.link} href={`./?path=/story/${story}`} target="_top">
      {children}
    </a>
  );
}

export function GuideLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={styles.link} href={href}>
      {children}
    </a>
  );
}

/** Where the spec lives, for links from a page to its source. */
export const SPEC = 'https://github.com/usmankadai/slip/blob/main/docs/spec';
