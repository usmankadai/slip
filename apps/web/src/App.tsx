import { useState } from 'react';
import { Footer } from './app/Footer.tsx';
import { DevHarness } from './dev/DevHarness.tsx';
import { ChangesScreen } from './features/changes/ChangesScreen.tsx';
import type { ChangeKind } from './features/changes/model.ts';
import { ImportScreen } from './features/import/ImportScreen.tsx';
import { SummaryScreen, type ComparedPair } from './features/summary/SummaryScreen.tsx';
import styles from './App.module.css';

const params = new URLSearchParams(location.search);
/** The undesigned developer harness, kept for the perf suite and for timing imports by hand. */
const SHOW_HARNESS = params.has('dev') || params.has('perf');

export function App() {
  const [pair, setPair] = useState<ComparedPair | null>(null);
  /** The kind of change the changes screen opens on, or null while the summary is showing. */
  const [changes, setChanges] = useState<ChangeKind | null>(null);
  if (SHOW_HARNESS) {
    return (
      <main>
        <h1>Slip</h1>
        <DevHarness />
      </main>
    );
  }
  return (
    <div className={styles.shell}>
      {pair && changes ? (
        <ChangesScreen pair={pair} initialKind={changes} onBack={() => setChanges(null)} />
      ) : pair ? (
        <SummaryScreen pair={pair} onBack={() => setPair(null)} onChanges={setChanges} />
      ) : (
        <ImportScreen onCompare={setPair} />
      )}
      <Footer />
    </div>
  );
}
