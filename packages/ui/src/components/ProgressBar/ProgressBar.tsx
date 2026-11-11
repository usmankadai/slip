import { useId } from 'react';
import styles from './ProgressBar.module.css';

export interface ProgressBarProps {
  /** Work done, in the same unit as `max`. Leave out when the total is not known. */
  value?: number;
  max?: number;
  /** What is happening, with the numbers and their units: "Reading: 252,000 rows · 61 of 84 MB". */
  label: string;
}

/** Progress of a job that has a known size, or an indeterminate bar when it does not. */
export function ProgressBar({ value, max = 1, label }: ProgressBarProps) {
  const id = useId();
  const known = value !== undefined && max > 0;
  return (
    <div className={styles.wrap}>
      <progress
        className={styles.bar}
        aria-labelledby={id}
        {...(known ? { value: Math.min(Math.max(value, 0), max), max } : {})}
      />
      <span id={id} className={styles.label}>
        {label}
      </span>
    </div>
  );
}
