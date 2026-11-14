import { useCallback, useEffect, useState } from 'react';
import { Footer } from './app/Footer.tsx';
import { AuditScreen } from './features/audit/AuditScreen.tsx';
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
import { count } from './shared/format.ts';
import { appendAudit, type AuditType } from './storage/auditLog.ts';
import { askToPersist, pairKey } from './storage/db.ts';
import { reopenSchedule } from './storage/reopen.ts';
import { clearOpenPair, loadOpenPair, saveOpenPair } from './storage/session.ts';
import { engine } from './app/engine.ts';
import { Notice } from '@slip/ui';
import { loadNarrative, saveNarrative } from './storage/narrativeStore.ts';
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
  /** True while the activity log is showing. */
  const [auditOpen, setAuditOpen] = useState(false);
  /** The key work is saved under: the two files and the project read from each. */
  const key = pair ? pairKey(pair.a, pair.b) : '';
  /** True while a saved narrative for this pair is being looked for. */
  const [restoring, setRestoring] = useState(false);
  /** Whether the last save worked: null until something has been saved. */
  const [saved, setSaved] = useState<boolean | null>(null);
  /** Whether the browser agreed to keep Slip's data under storage pressure. */
  const [persisted, setPersisted] = useState<boolean | null>(null);

  const audit = useCallback(
    (type: AuditType, summary: string) => {
      if (!key) return;
      void appendAudit({ pair: key, actor: 'user', type, summary }).then((ok) => {
        if (!ok) setSaved(false);
      });
    },
    [key],
  );

  // Save the narrative a moment after each change, so typing does not write on every key.
  useEffect(() => {
    if (!key || !blocks || restoring) return;
    const timer = setTimeout(() => void saveNarrative(key, blocks).then(setSaved), 400);
    return () => clearTimeout(timer);
  }, [key, blocks, restoring]);

  /** Shows a pair whose schedules are already in the engine, and picks up its saved work. */
  const open = useCallback((next: ComparedPair) => {
    const nextKey = pairKey(next.a, next.b);
    setBlocks(null);
    setSaved(null);
    setRestoring(true);
    setPair(next);
    // A narrative saved for this same pair, in this browser, is picked up again.
    void loadNarrative(nextKey).then((found) => {
      if (found) setBlocks(found);
      setRestoring(false);
    });
    void askToPersist().then(setPersisted);
    // Remembered so a reload can reopen it.
    void saveOpenPair(next);
  }, []);

  /** 'reopening' while the pair that was open before a reload is read back; '' when done. */
  const [reopening, setReopening] = useState<'checking' | 'reopening' | 'failed' | ''>(
    SHOW_HARNESS ? '' : 'checking',
  );
  const [reopeningName, setReopeningName] = useState('');
  useEffect(() => {
    if (SHOW_HARNESS) return;
    let current = true;
    void (async () => {
      const saved = await loadOpenPair();
      if (!current) return;
      if (!saved) {
        setReopening('');
        return;
      }
      setReopeningName(saved.b.projectName);
      setReopening('reopening');
      const [a, b] = await Promise.all([reopenSchedule(saved.a), reopenSchedule(saved.b)]);
      if (!current) return;
      try {
        if (!a || !b) throw new Error('not cached');
        await engine().load('a', a);
        await engine().load('b', b);
        if (!current) return;
        open(saved);
        setReopening('');
      } catch {
        void clearOpenPair();
        if (current) setReopening('failed');
      }
    })();
    return () => {
      current = false;
    };
  }, [open]);

  const compare = (next: ComparedPair) => {
    const nextKey = pairKey(next.a, next.b);
    setReopening('');
    open(next);
    const log = (type: AuditType, summary: string) =>
      void appendAudit({ pair: nextKey, actor: 'user', type, summary });
    log(
      'compared',
      `Compared ${next.a.fileName} (${count(next.a.activities)} activities) with ${next.b.fileName} (${count(next.b.activities)} activities).`,
    );
    for (const [name, facts] of [
      ['A', next.a],
      ['B', next.b],
    ] as const) {
      if (facts.incomplete)
        log('incomplete-used', `Used update ${name} as it is, though the file stopped early.`);
    }
  };
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
          onAudit={audit}
          saved={saved}
          restoring={restoring}
        />
      ) : null}
      {pair && auditOpen ? (
        <AuditScreen
          pair={pair}
          pairKey={key}
          persisted={persisted}
          onBack={() => setAuditOpen(false)}
        />
      ) : null}
      {pair && health && !narrative && !changes && !trace ? (
        <HealthScreen
          pair={pair}
          onBack={() => setHealth(false)}
          onActivities={(check) => setChanges({ kind: null, check })}
        />
      ) : null}
      {pair && !auditOpen && !health && !narrative && !changes && !trace ? (
        <SummaryScreen
          pair={pair}
          onBack={() => {
            void clearOpenPair();
            setPair(null);
          }}
          onChanges={(kind) => setChanges({ kind })}
          onHealth={() => setHealth(true)}
          onNarrative={() => setNarrative(true)}
          onAudit={() => setAuditOpen(true)}
          onTrace={setTrace}
        />
      ) : null}
      {reopening === 'checking' ? <main /> : null}
      {reopening === 'reopening' ? (
        <main className={styles.reopening} aria-busy="true">
          <Notice title={`Reopening ${reopeningName || 'the updates you had open'}`}>
            Reading both updates back from this browser&apos;s copy.
          </Notice>
        </main>
      ) : null}
      {pair || reopening === 'checking' || reopening === 'reopening' ? null : (
        <>
          {reopening === 'failed' ? (
            <div className={styles.reopening}>
              <Notice title="Slip could not reopen the updates you had open">
                This browser no longer has its copy of them. Drop the two files again; your
                narrative and activity log are kept and will come back.
              </Notice>
            </div>
          ) : null}
          <ImportScreen onCompare={compare} />
        </>
      )}
      <Footer />
    </div>
  );
}
