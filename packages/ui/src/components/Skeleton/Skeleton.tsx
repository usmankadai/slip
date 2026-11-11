import styles from './Skeleton.module.css';

export interface SkeletonProps {
  /** Roughly how long the text it stands in for will be. */
  width?: 'short' | 'medium' | 'long';
}

/** A grey bar that holds the place of text that is still being worked out. */
export function Skeleton({ width = 'medium' }: SkeletonProps) {
  return <span className={`${styles.skeleton} ${styles[width]}`} aria-hidden="true" />;
}
