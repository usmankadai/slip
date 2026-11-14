import styles from './EntityChip.module.css';

export interface EntityChipProps {
  /** What the chip names: an activity code, a kind of change, a health check. */
  label: string;
  /** `activity` sets the label in the code typeface. */
  kind?: 'activity' | 'other';
  /** Opens the thing the chip names. */
  onOpen: () => void;
  /** Read out instead of the label, when the label alone is not enough: "Open activity MS-COMPLETE". */
  description?: string;
}

/** A small button that names one piece of evidence and opens it. */
export function EntityChip({ label, kind = 'other', onOpen, description }: EntityChipProps) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${kind === 'activity' ? styles.activity : ''}`}
      title={label}
      aria-label={description}
      onClick={onOpen}
    >
      {label}
    </button>
  );
}
