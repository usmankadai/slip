import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Footer } from './app/Footer.tsx';
import { AgentDock } from './features/agent/AgentDock.tsx';
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
import { useEdits } from './app/useEdits.ts';
import {
  HOME_VIEW,
  namesPair,
  readUrl,
  sameScreen,
  updateId,
  writeUrl,
  type UrlState,
  type UrlView,
} from './app/urlState.ts';
import { NONE } from '@slip/xer';
import { Button, Notice } from '@slip/ui';
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
  /** The pair whose schedules are in the engine, even while the import screen shows. */
  const loadedPair = useRef<ComparedPair | null>(null);
  /** A link to a pair this browser does not have open, waiting for its two files. */
  const [wanted, setWanted] = useState<UrlState | null>(null);
  /** True while a view from the address bar is being looked up and put on screen. */
  const [applying, setApplying] = useState(false);

  /**
   * Puts a view from the address bar on screen. The URL holds only codes and numbers, so the
   * traced activity's name and dates, and a health check's name, are asked of the engine.
   */
  const applyView = useCallback(async (view: UrlView) => {
    setApplying(true);
    let target: TraceTarget | null = null;
    if (view.trace) {
      try {
        const found = await engine().request({ type: 'activity', taskCode: view.trace });
        if (found.current) {
          target = {
            code: found.current.taskCode,
            name: found.current.name,
            was: found.previous?.finish ?? NONE,
            now: found.current.finish,
          };
        }
      } catch {
        // An activity the engine cannot find is left out; the screen beneath still opens.
      }
    }
    let check: { id: number; name: string } | undefined;
    const checkId = view.changes?.check;
    if (checkId) {
      try {
        const health = await engine().request({ type: 'health', slot: 'b' });
        const found = health.checks.find((c) => c.id === checkId);
        if (found) check = { id: found.id, name: found.name };
      } catch {
        // Without its name the check cannot be shown honestly, so the grid opens without it.
      }
    }
    setAuditOpen(view.underneath === 'log');
    setNarrative(view.underneath === 'finish');
    setHealth(view.underneath === 'health');
    setChanges(
      view.changes
        ? {
            kind: view.changes.kind,
            ...(check ? { check } : {}),
            ...(view.changes.text ? { text: view.changes.text } : {}),
          }
        : null,
    );
    setTrace(target);
    setApplying(false);
  }, []);

  const audit = useCallback(
    (type: AuditType, summary: string, actor: 'user' | 'agent' = 'user') => {
      if (!key) return;
      void appendAudit({ pair: key, actor, type, summary }).then((ok) => {
        if (!ok) setSaved(false);
      });
    },
    [key],
  );

  const edits = useEdits(key, audit);
  /** How many saved changes could not be applied when the pair was last opened. */
  const [droppedEdits, setDroppedEdits] = useState(0);

  // Save the narrative a moment after each change, so typing does not write on every key.
  useEffect(() => {
    if (!key || !blocks || restoring) return;
    const timer = setTimeout(() => void saveNarrative(key, blocks).then(setSaved), 400);
    return () => clearTimeout(timer);
  }, [key, blocks, restoring]);

  /** Shows a pair whose schedules are already in the engine, and picks up its saved work. */
  const open = useCallback(
    (next: ComparedPair) => {
      const nextKey = pairKey(next.a, next.b);
      loadedPair.current = next;
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
      // Changes approved earlier for this pair are applied again.
      void edits.replay(nextKey).then(setDroppedEdits);
    },
    [edits.replay],
  );

  /** 'reopening' while the pair that was open before a reload is read back; '' when done. */
  const [reopening, setReopening] = useState<'checking' | 'reopening' | 'failed' | ''>(
    SHOW_HARNESS ? '' : 'checking',
  );
  const [reopeningName, setReopeningName] = useState('');
  useEffect(() => {
    if (SHOW_HARNESS) return;
    let current = true;
    void (async () => {
      const url = readUrl(location.search);
      const saved = await loadOpenPair();
      if (!current) return;
      if (url.pair && !(saved && namesPair(url, saved))) {
        // A link to updates this browser does not have open: ask for the files.
        setWanted(url);
        setReopening('');
        return;
      }
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
        if (url.pair) await applyView(url.view);
        if (!current) return;
        setReopening('');
      } catch {
        void clearOpenPair();
        if (current) setReopening('failed');
      }
    })();
    return () => {
      current = false;
    };
  }, [open, applyView]);

  /** What is on screen, as the address bar should show it. */
  const view = useMemo<UrlView>(
    () =>
      pair
        ? {
            underneath: auditOpen ? 'log' : narrative ? 'finish' : health ? 'health' : 'summary',
            changes: changes
              ? {
                  kind: changes.kind,
                  ...(changes.text ? { text: changes.text } : {}),
                  ...(changes.check ? { check: changes.check.id } : {}),
                }
              : null,
            trace: trace?.code ?? null,
          }
        : HOME_VIEW,
    [pair, auditOpen, narrative, health, changes, trace],
  );
  const shown = useRef<{ pairId: string; view: UrlView } | null>(null);

  // The address bar follows the screen. Moving to another screen adds a step to the browser's
  // history, so Back and Forward work; changing a filter on the same screen replaces it.
  useEffect(() => {
    if (SHOW_HARNESS || applying || wanted) return;
    if (reopening === 'checking' || reopening === 'reopening') return;
    const ids = pair ? { a: updateId(pair.a), b: updateId(pair.b) } : null;
    const pairId = ids ? `${ids.a}:${ids.b}` : '';
    const search = writeUrl({ pair: ids, view });
    const before = shown.current;
    shown.current = { pairId, view };
    if (search === location.search) return;
    const url = search || location.pathname;
    if (before === null || (before.pairId === pairId && sameScreen(before.view, view))) {
      history.replaceState(null, '', url);
    } else {
      history.pushState(null, '', url);
    }
  }, [pair, view, applying, reopening, wanted]);

  // Back and Forward in the browser.
  useEffect(() => {
    if (SHOW_HARNESS) return;
    const onPop = () => {
      const url = readUrl(location.search);
      shown.current = null;
      if (!url.pair) {
        setWanted(null);
        void applyView(HOME_VIEW);
        setPair(null);
        void clearOpenPair();
        return;
      }
      const loaded = loadedPair.current;
      if (loaded && namesPair(url, loaded)) {
        setWanted(null);
        setPair(loaded);
        void saveOpenPair(loaded);
        void applyView(url.view);
        return;
      }
      setPair(null);
      setWanted(url);
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [applyView]);

  const compare = (next: ComparedPair) => {
    const nextKey = pairKey(next.a, next.b);
    setReopening('');
    open(next);
    if (wanted) {
      // The files a link asked for: carry on to the view it points to. Other files: their summary.
      if (namesPair(wanted, next)) void applyView(wanted.view);
      setWanted(null);
    }
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
          key={edits.version}
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
            key={edits.version}
            pair={pair}
            initialKind={changes.kind}
            check={changes.check}
            initialText={changes.text}
            backLabel={narrative ? 'Finish update' : health ? 'health' : 'summary'}
            onBack={() => setChanges(null)}
            onTrace={setTrace}
            onFilter={({ kind, check, code }) =>
              setChanges((open) =>
                open
                  ? {
                      kind,
                      ...(check && open.check ? { check: open.check } : {}),
                      ...(code && open.text ? { text: open.text } : {}),
                    }
                  : open,
              )
            }
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
          key={edits.version}
          pair={pair}
          onBack={() => setHealth(false)}
          onActivities={(check) => setChanges({ kind: null, check })}
        />
      ) : null}
      {pair && !auditOpen && !health && !narrative && !changes && !trace ? (
        <SummaryScreen
          key={edits.version}
          pair={pair}
          appliedEdits={edits.count}
          droppedEdits={droppedEdits}
          onUndoEdits={() => void edits.undoAll()}
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
        // One block, so a notice above the import screen sits on top of it, not in a row of its own.
        <div className={styles.stack}>
          {wanted?.pair ? (
            <div className={styles.reopening}>
              <Notice
                title="This link is for two updates this browser does not have open"
                action={
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setWanted(null);
                      history.replaceState(null, '', location.pathname);
                    }}
                  >
                    Start without the link
                  </Button>
                }
              >
                Drop the two files it was made from, and Slip will open the view the link points to.
                Files are matched by their content, not their names: update A is{' '}
                <code>{wanted.pair.a}</code> and update B is <code>{wanted.pair.b}</code>.
              </Notice>
            </div>
          ) : null}
          {reopening === 'failed' ? (
            <div className={styles.reopening}>
              <Notice title="Slip could not reopen the updates you had open">
                This browser no longer has its copy of them. Drop the two files again; your
                narrative and activity log are kept and will come back.
              </Notice>
            </div>
          ) : null}
          <ImportScreen onCompare={compare} />
        </div>
      )}
      {pair && !reopening ? (
        <AgentDock
          key={key}
          edits={edits}
          onAudit={audit}
          onOpenActivity={(code) => {
            setTrace(null);
            setChanges({ kind: null, text: code });
          }}
        />
      ) : null}
      <Footer />
    </div>
  );
}
