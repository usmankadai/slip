import { useCallback, useState } from 'react';
import { Footer } from './app/Footer.tsx';
import { DevHarness } from './dev/DevHarness.tsx';
import { ChangesScreen } from './features/changes/ChangesScreen.tsx';
import type { ChangeKind } from './features/changes/model.ts';
import { HealthScreen } from './features/health/HealthScreen.tsx';
import { ImportScreen } from './features/import/ImportScreen.tsx';
import type { Block, Evidence } from './features/narrative/model.ts';
import { NarrativeScreen } from './features/narrative/NarrativeScreen.tsx';
import { SummaryScreen, type ComparedPair } from './features/summary/SummaryScreen.tsx';
import { TraceScreen } from './features/trace/TraceScreen.tsx';
import type { TraceTarget } from './features/trace/TraceView.tsx';
import styles from './App.module.css';

const params = new URLSearchParams(location.search);
/** The undesigned developer harness, kept for the perf suite and for timing imports by hand. */
const SHOW_HARNESS = params.has('dev') || params.has('perf');

export function App() {
  const [pair, setPair] = useState<ComparedPair | null>(null);
  /** What the changes screen opens on, or null while it is not showing. */
  const [changes, setChanges] = useState<{
    kind: ChangeKind | null;
    check?: { id: number; name: string };
    text?: string;
  } | null>(null);
  /** True while the Finish update screen is showing, or waiting behind the changes screen. */
  const [narrative, setNarrative] = useState(false);
  /** The narrative's paragraphs, kept here so edits survive moving between screens. */
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const onBlocks = useCallback(
    (update: (all: Block[]) => Block[]) => setBlocks((all) => update(all ?? [])),
    [],
  );
  const openEvidence = useCallback((evidence: Evidence) => {
    if (evidence.type === 'activity') setChanges({ kind: null, text: evidence.code });
    else if (evidence.type === 'change') setChanges({ kind: evidence.kind });
    else setChanges({ kind: null, check: { id: evidence.id, name: evidence.name } });
  }, []);
  /** True while the health screen is showing, or waiting behind the changes screen. */
  const [health, setHealth] = useState(false);
  /** The activity being traced, or null. It is shown over whichever screen asked for it. */
  const [trace, setTrace] = useState<TraceTarget | null>(null);
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
      {pair && trace ? (
        <TraceScreen
          projectName={pair.b.projectName}
          target={trace}
          backLabel={changes ? 'changes' : 'summary'}
          onBack={() => setTrace(null)}
        />
      ) : null}
      {pair && changes ? (
        // Kept in place, out of sight, while a trace is open, so the planner comes back to
        // the same rows, selection and scroll position.
        <div className={trace ? styles.setAside : styles.inPlace}>
          <ChangesScreen
            pair={pair}
            initialKind={changes.kind}
            check={changes.check}
            initialText={changes.text}
            backLabel={narrative ? 'Finish update' : health ? 'health' : 'summary'}
            onBack={() => setChanges(null)}
            onTrace={setTrace}
          />
        </div>
      ) : null}
      {pair && narrative && !changes && !trace ? (
        <NarrativeScreen
          pair={pair}
          blocks={blocks}
          onBlocks={onBlocks}
          onEvidence={openEvidence}
          onBack={() => setNarrative(false)}
        />
      ) : null}
      {pair && health && !narrative && !changes && !trace ? (
        <HealthScreen
          pair={pair}
          onBack={() => setHealth(false)}
          onActivities={(check) => setChanges({ kind: null, check })}
        />
      ) : null}
      {pair && !health && !narrative && !changes && !trace ? (
        <SummaryScreen
          pair={pair}
          onBack={() => setPair(null)}
          onChanges={(kind) => setChanges({ kind })}
          onHealth={() => setHealth(true)}
          onNarrative={() => setNarrative(true)}
          onTrace={setTrace}
        />
      ) : null}
      {pair ? null : (
        <ImportScreen
          onCompare={(next) => {
            // A new pair needs a new narrative.
            setBlocks(null);
            setPair(next);
          }}
        />
      )}
      <Footer />
    </div>
  );
}
