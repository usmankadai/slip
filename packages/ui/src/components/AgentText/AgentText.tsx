import { EntityChip } from '../EntityChip/EntityChip.tsx';
import styles from './AgentText.module.css';

export interface AgentTextPart {
  kind: 'text' | 'verified' | 'unverified';
  /** For a citation, the activity code. */
  text: string;
}

export interface AgentTextProps {
  /** The answer, already split into text and citations checked against the tool results. */
  parts: readonly AgentTextPart[];
  /** Opens a cited activity. */
  onOpen: (code: string) => void;
}

/**
 * An answer from the assistant. A cited activity that was in the tool results is a chip;
 * one that was not is plain text marked "unverified" where it stands (exploration 05).
 */
export function AgentText({ parts, onOpen }: AgentTextProps) {
  return (
    <p className={styles.text}>
      {parts.map((part, index) =>
        part.kind === 'verified' ? (
          <EntityChip
            key={index}
            kind="activity"
            label={part.text}
            description={`Open activity ${part.text}`}
            onOpen={() => onOpen(part.text)}
          />
        ) : part.kind === 'unverified' ? (
          <span key={index}>
            <span className={styles.unverified}>{part.text}</span>
            <span className={styles.flag}>unverified</span>
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}
