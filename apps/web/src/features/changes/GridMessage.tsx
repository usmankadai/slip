import type { ReactNode } from 'react';
import styles from './changes.module.css';

/** What stands in the grid's place when there are no rows to show: nothing matches, or the rows could not be read. */
export function GridMessage({
  title,
  body,
  action,
  alert = false,
}: {
  title: string;
  body: string;
  action: ReactNode;
  /** True for a failure, so it is announced. */
  alert?: boolean;
}) {
  return (
    <div className={styles.gridFrame}>
      <div className={styles.message} role={alert ? 'alert' : undefined}>
        <p className={styles.messageTitle}>{title}</p>
        <p className={styles.messageBody}>{body}</p>
        {action}
      </div>
    </div>
  );
}
