import { useState } from 'react';
import { count, plural } from './format.ts';
import styles from './import.module.css';
import type { Report, ReportRow } from './warnings.ts';

function Row({ row, marked }: { row: ReportRow; marked: boolean }) {
  const [open, setOpen] = useState(false);
  const more = row.count - row.examples.length;
  return (
    <li className={styles.warning}>
      <button
        type="button"
        className={styles.warningHead}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        disabled={row.examples.length === 0}
      >
        <span className={styles.caret} aria-hidden="true">
          {row.examples.length === 0 ? '' : open ? '▾' : '▸'}
        </span>
        <span>
          {marked ? <span className={styles.mark} aria-hidden="true" /> : null}
          {row.name}
        </span>
        <span className={styles.warningCount}>{count(row.count)}</span>
      </button>
      <p className={styles.warningDid}>{row.did}</p>
      {row.share ? <p className={styles.warningShare}>{row.share}</p> : null}
      {open ? (
        <ul className={styles.examples} aria-label={`Examples of ${row.name}`}>
          {row.examples.map((example, index) => (
            <li key={index}>{example}</li>
          ))}
          {more > 0 ? <li>and {count(more)} more</li> : null}
        </ul>
      ) : null}
    </li>
  );
}

/** The import report for one file (exploration 08, option B). */
export function ImportReport({ report }: { report: Report }) {
  if (report.total === 0) {
    return (
      <section className={styles.report} aria-label="Import report">
        <h3 className={styles.reportTitle}>Import report</h3>
        <p className={styles.reportNone}>No warnings. Every row was read as written.</p>
      </section>
    );
  }
  return (
    <section className={styles.report} aria-label="Import report">
      <h3 className={styles.reportTitle}>
        Import report: {plural(report.total, 'warning')} of {plural(report.kinds, 'kind')}
      </h3>
      {report.groups.map((group) => (
        <div key={group.id}>
          <h4 className={styles.group}>
            <span>{group.title}</span>
            <span>{count(group.total)}</span>
          </h4>
          <ul className={styles.warnings}>
            {group.rows.map((row) => (
              <Row key={row.kind} row={row} marked={group.id === 'dates'} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
