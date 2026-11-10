/**
 * Installs window.slipPerf, the hook the perf suite drives. It only exists
 * when the page is opened with ?perf, so normal use is unaffected.
 */
import { getTransferList } from '@slip/xer';
import { clearCache } from '../storage/scheduleCache.ts';
import { generateSchedules, importSchedule, type ImportResult } from '../workers/client.ts';
import { EngineClient } from '../workers/engineClient.ts';
import type { SlipPerfApi } from './perfTypes.ts';

export function installPerfApi(): void {
  let files: Blob[] = [];
  // Imported schedules are kept so that memory can be measured with both updates loaded.
  const held: ImportResult[] = [];
  const longTasks: number[] = [];
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    }).observe({ entryTypes: ['longtask'] });
  }

  const api: SlipPerfApi = {
    async prepare(activities) {
      const pair = await generateSchedules({ activities, seed: 42, sector: 'rail' });
      files = [pair.update01, pair.update02];
      return pair.generateMs;
    },
    async importPrepared(which) {
      const file = files[which];
      if (!file) throw new Error('Call prepare first.');
      longTasks.length = 0;
      const started = performance.now();
      const result = await importSchedule(file);
      const wallMs = performance.now() - started;
      // Give the observer a turn to deliver entries from the import.
      await new Promise((resolve) => setTimeout(resolve, 50));
      held[which] = result;
      const { data, timings } = result;
      return {
        wallMs,
        hashMs: timings.hashMs,
        parseMs: timings.parseMs,
        cacheMs: timings.cacheMs,
        fromCache: result.fromCache,
        cached: result.cached,
        activities: data.n,
        relationships: data.meta.relationshipCount,
        warnings: data.meta.warnings.length,
        fileBytes: file.size,
        bufferBytes: getTransferList(data).reduce((total, buffer) => total + buffer.byteLength, 0),
        longTasks: longTasks.slice(),
      };
    },
    async engine() {
      const [a, b] = held;
      if (!a || !b) throw new Error('Import both files first.');
      const engine = new EngineClient();
      const timed = async <T>(work: () => Promise<T>): Promise<[T, number]> => {
        const started = performance.now();
        const result = await work();
        return [result, performance.now() - started];
      };
      try {
        await engine.ping();
        longTasks.length = 0;
        const [, loadMs] = await timed(() =>
          Promise.all([engine.load('a', a.data), engine.load('b', b.data)]),
        );
        const [cpm, cpmMs] = await timed(() => engine.request({ type: 'cpm', slot: 'b' }));
        const [diff, diffMs] = await timed(() => engine.request({ type: 'diff' }));
        const view = {
          filter: { changedOnly: true },
          sort: { column: 'finishDeltaDays', direction: 'desc' },
        } as const;
        const columns = [
          'code',
          'name',
          'start',
          'finish',
          'finishDelta',
          'totalFloat',
          'flags',
        ] as const;
        const [, firstRowsMs] = await timed(() =>
          engine.request({
            type: 'rows',
            slot: 'b',
            range: [0, 60],
            columns: [...columns],
            ...view,
          }),
        );
        const [, scrollRowsMs] = await timed(() =>
          engine.request({
            type: 'rows',
            slot: 'b',
            range: [5000, 5060],
            columns: [...columns],
            ...view,
          }),
        );
        const [, searchMs] = await timed(() =>
          engine.request({
            type: 'rows',
            slot: 'b',
            range: [0, 60],
            columns: ['code', 'name'],
            filter: { text: 'signal gantry' },
          }),
        );
        const [, sortByCodeMs] = await timed(() =>
          engine.request({
            type: 'rows',
            slot: 'b',
            range: [0, 60],
            columns: ['code'],
            sort: { column: 'code', direction: 'desc' },
          }),
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          loadMs,
          cpmMs,
          diffMs,
          firstRowsMs,
          scrollRowsMs,
          searchMs,
          sortByCodeMs,
          changed: diff.changed,
          activities: diff.activitiesB,
          differsFromFile: cpm.differsFromFile,
          longTasks: longTasks.slice(),
        };
      } finally {
        engine.dispose();
        held.length = 0;
      }
    },
    clearCache,
    reset() {
      files = [];
      held.length = 0;
    },
  };
  window.slipPerf = api;
}
