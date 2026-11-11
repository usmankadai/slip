/**
 * Drives the import screen: reads files in the parse worker, hands each
 * schedule to the engine worker, then asks the engine how the two compare.
 * Only small facts are kept in React state; the schedule itself is
 * transferred to the engine and never held here (D3).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { engine } from '../../app/engine.ts';
import { generateSchedules, importSchedule, ImportError } from '../../workers/client.ts';
import { errorCopy, rejectBeforeReading } from './errors.ts';
import { checkPair } from './pair.ts';
import {
  EMPTY_STATE,
  type ImportState,
  type SlotFacts,
  type SlotId,
  type SlotState,
} from './types.ts';
import { buildReport } from './warnings.ts';

const SAMPLE = { activities: 10_000, seed: 42, sector: 'rail' } as const;

interface SlotJob {
  /** Bumped whenever the slot is given new work, so a late answer from old work is ignored. */
  token: number;
  file: File | null;
  projectId: number | undefined;
  abort: AbortController | null;
}

export function useImport() {
  const [state, setState] = useState<ImportState>(EMPTY_STATE);
  const jobs = useRef<Record<SlotId, SlotJob>>({
    a: { token: 0, file: null, projectId: undefined, abort: null },
    b: { token: 0, file: null, projectId: undefined, abort: null },
  });
  const pairToken = useRef(0);
  /** Set when two files arrive together: Slip then orders them by data date itself. */
  const orderWhenReady = useRef(false);
  const latest = useRef(state);
  latest.current = state;

  const setSlot = useCallback((slot: SlotId, value: SlotState) => {
    setState((previous) => ({ ...previous, [slot]: value }));
  }, []);

  const read = useCallback(
    async (slot: SlotId, file: File, projectId?: number) => {
      const job = jobs.current[slot];
      job.abort?.abort();
      const token = ++job.token;
      job.file = file;
      job.projectId = projectId;
      job.abort = new AbortController();
      pairToken.current++;
      setState((previous) => ({ ...previous, pair: { status: 'absent' } }));

      const rejected = rejectBeforeReading(file);
      if (rejected) {
        setSlot(slot, { status: 'error', fileName: file.name, ...rejected });
        return;
      }
      const loading = (
        phase: 'hashing' | 'parsing' | 'caching' | 'loading',
        rows = 0,
        bytesRead = 0,
      ) =>
        setSlot(slot, {
          status: 'loading',
          fileName: file.name,
          phase,
          rows,
          bytesRead,
          totalBytes: file.size,
        });
      loading('hashing');
      let rows = 0;
      try {
        const result = await importSchedule(
          file,
          (event) => {
            if (job.token !== token) return;
            if (event.phase === 'parsing') rows = event.rowsParsed;
            loading(event.phase, event.rowsParsed, event.bytesRead);
          },
          job.abort.signal,
          projectId,
        );
        if (job.token !== token) return;
        const { data } = result;
        // Copy the small facts out before the schedule is transferred to the engine.
        const meta = data.meta;
        const facts: SlotFacts = {
          fileName: file.name,
          projectName: meta.projectName,
          projectId: meta.projectId,
          dataDate: meta.dataDate,
          activities: data.n,
          relationships: meta.relationshipCount,
          sourceHash: meta.sourceHash,
          projects: meta.projects.map((project) => ({ ...project })),
          incomplete: meta.incomplete,
          incompleteAccepted: false,
          report: buildReport(meta.warnings, {
            activities: data.n,
            relationships: meta.relationshipCount,
            rows,
          }),
        };
        loading('loading', rows, file.size);
        await engine().load(slot, data);
        if (job.token !== token) return;
        setSlot(slot, { status: 'ready', facts });
      } catch (error) {
        if (job.token !== token) return;
        const code = error instanceof ImportError ? error.code : 'failed';
        if (code === 'cancelled') {
          job.file = null;
          setSlot(slot, { status: 'empty' });
          return;
        }
        setSlot(slot, { status: 'error', fileName: file.name, ...errorCopy(code, file.name) });
      }
    },
    [setSlot],
  );

  // When both slots are ready, ask the engine how the two compare.
  const a = state.a;
  const b = state.b;
  useEffect(() => {
    if (a.status !== 'ready' || b.status !== 'ready') return;
    if (orderWhenReady.current) {
      orderWhenReady.current = false;
      if (a.facts.dataDate > b.facts.dataDate) {
        const [fileA, fileB] = [jobs.current.a.file, jobs.current.b.file];
        if (fileA && fileB) {
          void read('a', fileB, jobs.current.b.projectId);
          void read('b', fileA, jobs.current.a.projectId);
          return;
        }
      }
    }
    const token = ++pairToken.current;
    setState((previous) => ({ ...previous, pair: { status: 'checking' } }));
    engine()
      .request({ type: 'diff' })
      .then(
        (diff) => {
          if (pairToken.current !== token) return;
          const matched = diff.activitiesB - diff.counts.Added;
          setState((previous) => ({
            ...previous,
            pair: { status: 'checked', check: checkPair(a.facts, b.facts, matched) },
          }));
        },
        () => {
          if (pairToken.current !== token) return;
          setState((previous) => ({ ...previous, pair: { status: 'failed' } }));
        },
      );
  }, [a, b, read]);

  const onFile = useCallback((slot: SlotId, file: File) => void read(slot, file), [read]);

  const onFiles = useCallback(
    (files: File[]) => {
      if (files.length === 1) {
        const current = latest.current;
        const slot: SlotId =
          current.a.status === 'empty' || current.b.status !== 'empty' ? 'a' : 'b';
        void read(slot, files[0]!);
        return;
      }
      orderWhenReady.current = true;
      void read('a', files[0]!);
      void read('b', files[1]!);
    },
    [read],
  );

  const onCancel = useCallback((slot: SlotId) => jobs.current[slot].abort?.abort(), []);

  const onRetry = useCallback(
    (slot: SlotId) => {
      const job = jobs.current[slot];
      if (job.file) void read(slot, job.file, job.projectId);
    },
    [read],
  );

  const onProject = useCallback(
    (slot: SlotId, projectId: number) => {
      const file = jobs.current[slot].file;
      if (file) void read(slot, file, projectId);
    },
    [read],
  );

  const onAcceptIncomplete = useCallback((slot: SlotId) => {
    setState((previous) => {
      const current = previous[slot];
      if (current.status !== 'ready') return previous;
      return {
        ...previous,
        [slot]: { status: 'ready', facts: { ...current.facts, incompleteAccepted: true } },
      };
    });
  }, []);

  const onSwap = useCallback(() => {
    const [fileA, fileB] = [jobs.current.a.file, jobs.current.b.file];
    const [projectA, projectB] = [jobs.current.a.projectId, jobs.current.b.projectId];
    if (!fileA || !fileB) return;
    void read('a', fileB, projectB);
    void read('b', fileA, projectA);
  }, [read]);

  const onGenerate = useCallback(async () => {
    for (const slot of ['a', 'b'] as const) {
      const job = jobs.current[slot];
      job.abort?.abort();
      job.token++;
      job.file = null;
    }
    pairToken.current++;
    const generating = (index: number): SlotState => ({
      status: 'loading',
      fileName: `sample-rail-10k-update-0${index}.xer`,
      phase: 'generating',
      rows: 0,
      bytesRead: 0,
      totalBytes: 0,
    });
    setState({ a: generating(1), b: generating(2), pair: { status: 'absent' }, generating: true });
    try {
      const pair = await generateSchedules(SAMPLE);
      setState((previous) => ({ ...previous, generating: false }));
      const file = (blob: Blob, index: number) =>
        new File([blob], `sample-rail-10k-update-0${index}.xer`, { type: 'text/plain' });
      void read('a', file(pair.update01, 1));
      void read('b', file(pair.update02, 2));
    } catch {
      const failed: SlotState = {
        status: 'error',
        fileName: 'the sample pair',
        title: 'Slip could not generate a sample pair',
        detail: 'Something went wrong while building the sample schedules.',
        retry: false,
      };
      setState({ a: failed, b: failed, pair: { status: 'absent' }, generating: false });
    }
  }, [read]);

  return {
    state,
    handlers: {
      onFile,
      onFiles,
      onCancel,
      onRetry,
      onProject,
      onAcceptIncomplete,
      onSwap,
      onGenerate,
    },
  };
}
