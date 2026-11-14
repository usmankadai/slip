import { useId, useState } from 'react';
import styles from './AgentSteps.module.css';

export interface AgentStep {
  tool: string;
  /** The input in a few words. */
  input: string;
  /** What came back in a few words. */
  result: string;
  isError: boolean;
}

export interface AgentStepsProps {
  steps: readonly AgentStep[];
  /** Seconds the answer took; left out while it is still working. */
  seconds?: number;
  working?: boolean;
}

/**
 * The assistant's working, folded into one line ("Worked for 3s, 2 steps") that opens
 * to the tool calls and what each returned (exploration 05, option A).
 */
export function AgentSteps({ steps, seconds, working = false }: AgentStepsProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const count = `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`;
  const line = working
    ? `Working, ${count} so far`
    : seconds === undefined
      ? count
      : `Worked for ${Math.max(1, Math.round(seconds))}s, ${count}`;
  if (steps.length === 0 && !working) return null;
  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        disabled={steps.length === 0}
      >
        <span className={styles.caret} aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        {line}
      </button>
      {open ? (
        <ol id={id} className={styles.list}>
          {steps.map((step, index) => (
            <li key={index}>
              <span className={styles.tool}>{step.tool}</span>
              {step.input ? ` (${step.input})` : ''}:{' '}
              <span className={step.isError ? styles.failed : undefined}>
                {step.isError ? `failed: ${step.result}` : step.result}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
