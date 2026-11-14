import { Button, Notice, Skeleton } from '@slip/ui';
import { longDate } from '../../shared/format.ts';
import type { AuditEntry } from '../../storage/auditLog.ts';
import styles from './audit.module.css';

export type AuditState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; entries: AuditEntry[] };

export interface AuditViewProps {
  projectName: string;
  dataDateA: number;
  dataDateB: number;
  state: AuditState;
  /** Whether the browser agreed to keep Slip's data under storage pressure; null if not known. */
  persisted: boolean | null;
  onBack: () => void;
}

const WHEN = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const ACTOR = { user: 'You', agent: 'The assistant' } as const;

/** The audit log for one pair of updates, newest first. Presentational. */
export function AuditView({
  projectName,
  dataDateA,
  dataDateB,
  state,
  persisted,
  onBack,
}: AuditViewProps) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{projectName || 'Project with no name'}</h1>
          <p className={styles.period}>
            Activity log · {longDate(dataDateA)} to {longDate(dataDateB)}
          </p>
        </div>
        <Button variant="quiet" onClick={onBack}>
          Back to summary
        </Button>
      </header>

      <Notice>
        Everything done to these two updates is listed here and kept in this browser only. Nothing
        is ever removed from the log.
        {persisted === false
          ? ' This browser may clear it if it runs short of space.'
          : persisted
            ? ' The browser has agreed not to clear it to save space.'
            : ''}
      </Notice>

      {state.status === 'loading' ? (
        <section className={styles.box} aria-busy="true">
          <p className={styles.say}>Reading the log</p>
          <Skeleton width="long" />
          <Skeleton width="medium" />
        </section>
      ) : state.status === 'error' ? (
        <section className={styles.box}>
          <p className={styles.answer}>Slip could not read the log</p>
          <p className={styles.say} role="alert">
            This browser is not keeping Slip&apos;s data, for example in a private window, so
            nothing has been logged.
          </p>
        </section>
      ) : state.entries.length === 0 ? (
        <section className={styles.box}>
          <p className={styles.answer}>Nothing logged yet</p>
          <p className={styles.say}>
            Comparing these updates, editing or exporting the narrative, and approving or rejecting
            a change will be listed here.
          </p>
        </section>
      ) : (
        <section className={styles.box} aria-label="Log">
          <ol className={styles.log}>
            {state.entries.map((entry) => (
              <li key={entry.id ?? `${entry.at}-${entry.summary}`} className={styles.entry}>
                <time className={styles.when} dateTime={new Date(entry.at).toISOString()}>
                  {WHEN.format(entry.at)}
                </time>
                <span className={styles.actor}>{ACTOR[entry.actor]}</span>
                <span>{entry.summary}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
