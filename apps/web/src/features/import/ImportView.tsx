import { useState, type DragEvent } from 'react';
import { Button, Notice } from '@slip/ui';
import { ImportSlot, type SlotHandlers } from './ImportSlot.tsx';
import styles from './import.module.css';
import { compareBlocker, type ImportState } from './types.ts';

export interface ImportViewProps extends SlotHandlers {
  state: ImportState;
  /** Two or more files dropped together; Slip puts them in order by data date. */
  onFiles: (files: File[]) => void;
  onSwap: () => void;
  onGenerate: () => void;
  onCompare: () => void;
}

/** The import screen, layout A: two slots side by side. Presentational; `useImport` drives it. */
export function ImportView({
  state,
  onFiles,
  onSwap,
  onGenerate,
  onCompare,
  ...handlers
}: ImportViewProps) {
  const [over, setOver] = useState(false);
  const blocker = compareBlocker(state);
  const busy = state.a.status === 'loading' || state.b.status === 'loading' || state.generating;
  const nothingLoaded = state.a.status === 'empty' && state.b.status === 'empty';
  const pair = state.pair;
  const fix = pair.status === 'checked' && pair.check.kind === 'wrong-order';

  return (
    <main
      className={`${styles.screen} ${over ? styles.screenOver : ''}`}
      onDragOver={(event: DragEvent) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event: DragEvent) => {
        event.preventDefault();
        setOver(false);
        const files = [...event.dataTransfer.files];
        if (files.length > 0) onFiles(files);
      }}
    >
      <h1 className={styles.title}>Import two updates</h1>
      <div className={styles.slots}>
        <ImportSlot id="a" state={state.a} handlers={handlers} />
        <ImportSlot id="b" state={state.b} handlers={handlers} />
      </div>

      {nothingLoaded ? (
        <p className={styles.hint}>
          Drop both files at once and Slip puts them in order by data date.
        </p>
      ) : null}
      {pair.status === 'checking' ? <Notice>Checking that the two belong together.</Notice> : null}
      {pair.status === 'failed' ? (
        <Notice tone="attention">
          Slip could not check whether these two belong together. Replace a file to try again.
        </Notice>
      ) : null}
      {pair.status === 'checked' ? (
        <Notice
          tone={
            pair.check.kind === 'sound' || pair.check.kind === 'same-date' ? 'plain' : 'attention'
          }
          action={
            fix ? (
              <Button variant="primary" onClick={onSwap}>
                Swap them
              </Button>
            ) : undefined
          }
        >
          {pair.check.sentence}
        </Notice>
      ) : null}

      <div className={styles.foot}>
        <div className={styles.compare}>
          <Button
            variant={fix ? 'default' : 'primary'}
            disabled={blocker !== ''}
            onClick={onCompare}
          >
            Compare updates
          </Button>
          {blocker ? <span className={styles.blocker}>{blocker}</span> : null}
        </div>
        <div className={styles.sample}>
          <span>No files to hand?</span>
          <Button variant="quiet" disabled={busy} onClick={onGenerate}>
            Generate a sample pair
          </Button>
        </div>
      </div>
    </main>
  );
}
