import styles from './DeltaCell.module.css';

export interface DeltaCellProps {
  /** The move in working days: positive is later, negative is earlier, null is nothing to compare. */
  days: number | null;
}

/** A bar reaches full length at this many working days, the top band of the slip scale (D16). */
export const FULL_SCALE_DAYS = 40;

/** "+67d", "−2.5d", "0d". The minus is a true minus sign, so it is as wide as the plus. */
export function formatDelta(days: number): string {
  const size = Math.round(Math.abs(days) * 10) / 10;
  if (size === 0) return '0d';
  return `${days > 0 ? '+' : '−'}${size.toLocaleString('en-GB', { maximumFractionDigits: 1 })}d`;
}

/** Half the track's width, 0 to 50, on a square root scale that is fixed across every view. */
export function barLength(days: number): number {
  const size = Math.min(Math.abs(days), FULL_SCALE_DAYS);
  return Math.sqrt(size / FULL_SCALE_DAYS) * 50;
}

/**
 * How far a date moved between two updates: a signed number of working days and a bar from
 * a centre line (exploration 01, option B). Later grows to the right, earlier to the left,
 * so direction is carried by position as well as colour.
 */
export function DeltaCell({ days }: DeltaCellProps) {
  if (days === null || !Number.isFinite(days)) return <span className={styles.cell} />;
  const length = barLength(days);
  const full = Math.abs(days) >= FULL_SCALE_DAYS;
  const moved = formatDelta(days) !== '0d';
  const later = days > 0;
  const barClass = later
    ? full
      ? styles.lateFull
      : styles.late
    : full
      ? styles.earlyFull
      : styles.early;
  return (
    <span className={styles.cell}>
      <svg
        className={styles.track}
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {moved ? (
          <rect className={barClass} x={later ? 50 : 50 - length} y={1} width={length} height={6} />
        ) : null}
        <rect className={styles.axis} x={49.5} y={0} width={1} height={8} />
      </svg>
      <span className={`${styles.number} ${moved ? '' : styles.none}`}>{formatDelta(days)}</span>
    </span>
  );
}
