/**
 * Installs window.slipPerf, the hook the perf suite drives. It only exists
 * when the page is opened with ?perf, so normal use is unaffected.
 */
import { getTransferList } from '@slip/xer';
import { clearCache } from '../storage/scheduleCache.ts';
import { generateSchedules, importSchedule, type ImportResult } from '../workers/client.ts';
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
    clearCache,
    reset() {
      files = [];
      held.length = 0;
    },
  };
  window.slipPerf = api;
}
