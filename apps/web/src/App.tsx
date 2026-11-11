import { useState } from 'react';
import { Button, Notice } from '@slip/ui';
import { DevHarness } from './dev/DevHarness.tsx';
import { ImportScreen } from './features/import/ImportScreen.tsx';
import styles from './App.module.css';

const params = new URLSearchParams(location.search);
/** The undesigned developer harness, kept for the perf suite and for timing imports by hand. */
const SHOW_HARNESS = params.has('dev') || params.has('perf');

export function App() {
  const [compared, setCompared] = useState(false);
  if (SHOW_HARNESS) {
    return (
      <main>
        <h1>Slip</h1>
        <DevHarness />
      </main>
    );
  }
  if (compared) {
    return (
      <main className={styles.placeholder}>
        <Notice
          title="The update summary is not built yet"
          action={<Button onClick={() => setCompared(false)}>Back to import</Button>}
        >
          Both updates are loaded and compared. The screen that shows what changed comes next.
        </Notice>
      </main>
    );
  }
  return <ImportScreen onCompare={() => setCompared(true)} />;
}
