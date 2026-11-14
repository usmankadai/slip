import styles from './ScriptedBadge.module.css';

/** Says an answer is canned, not written by a model. On every scripted answer. */
export function ScriptedBadge() {
  return <span className={styles.badge}>Scripted answer, not AI</span>;
}
