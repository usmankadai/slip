import type { ReactNode } from 'react';
import styles from './Notice.module.css';

export interface NoticeProps {
  /** `attention` is for something the planner should act on or know before going on. */
  tone?: 'plain' | 'attention';
  /** A short statement of what happened. Optional when the body is one sentence. */
  title?: string;
  children: ReactNode;
  /** The suggested fix, as one or two buttons. */
  action?: ReactNode;
}

/** A message that stays on screen: a check that was made, a warning, a question. */
export function Notice({ tone = 'plain', title, children, action }: NoticeProps) {
  return (
    <div
      className={`${styles.notice} ${tone === 'attention' ? styles.attention : ''}`}
      role={tone === 'attention' ? 'alert' : 'status'}
    >
      <div className={styles.text}>
        {title ? <span className={styles.title}>{title}</span> : null}
        <span className={styles.body}>{children}</span>
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
