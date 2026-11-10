/**
 * Developer harness. This is not a designed screen and uses no design
 * system on purpose: it exists to run the generate, import and cache path
 * in a real browser and show the timings, until the import screen is built.
 */
import { useEffect, useRef, useState } from 'react';
import { formatXerDate, stringAt, type ScheduleData } from '@slip/xer';
import { clearCache, listCached, removeStale, type CacheEntry } from '../storage/scheduleCache.ts';
import { generateSchedules, importSchedule, type ImportResult } from '../workers/client.ts';

const SIZES = [1_000, 10_000, 100_000, 350_000, 1_000_000];

interface Row {
  label: string;
  megabytes: number;
  result: ImportResult;
  firstCode: string;
}

interface Run {
  activities: number;
  generateMs: number;
  slip: string;
  rows: Row[];
  longTasks: number;
  longestTaskMs: number;
}

function firstCode(data: ScheduleData): string {
  return data.n > 0 ? stringAt(data.strings, data.taskCode[0]!) : '';
}

const ms = (value: number) => `${Math.round(value)}ms`;

export function DevHarness() {
  const [status, setStatus] = useState('Idle');
  const [runs, setRuns] = useState<Run[]>([]);
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const longTasks = useRef<number[]>([]);

  useEffect(() => {
    void removeStale().then(listCached).then(setEntries);
    if (!PerformanceObserver.supportedEntryTypes.includes('longtask')) return;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.current.push(entry.duration);
    });
    observer.observe({ entryTypes: ['longtask'] });
    return () => observer.disconnect();
  }, []);

  async function run(activities: number) {
    setBusy(true);
    longTasks.current = [];
    try {
      setStatus(`Generating ${activities.toLocaleString('en-GB')} activities`);
      const pair = await generateSchedules({ activities, seed: 42, sector: 'rail' });
      const rows: Row[] = [];
      for (const [label, blob] of [
        ['update 01', pair.update01],
        ['update 02', pair.update02],
      ] as const) {
        const result = await importSchedule(blob, (event) =>
          setStatus(
            `${label}: ${event.phase}, ${event.rowsParsed.toLocaleString('en-GB')} rows, ${(event.bytesRead / 1e6).toFixed(0)} of ${(event.totalBytes / 1e6).toFixed(0)}MB`,
          ),
        );
        rows.push({ label, megabytes: blob.size / 1e6, result, firstCode: firstCode(result.data) });
      }
      const { milestone } = pair.expected;
      setRuns((previous) => [
        {
          activities,
          generateMs: pair.generateMs,
          slip: `${milestone.code} slips ${milestone.slipWorkingDays} working days`,
          rows,
          longTasks: longTasks.current.length,
          longestTaskMs: Math.max(0, ...longTasks.current),
        },
        ...previous,
      ]);
      setStatus('Done');
    } catch (error) {
      setStatus(`Failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setEntries(await listCached());
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Developer harness</h2>
      <p>
        Not a designed screen. Generates a synthetic pair in a worker, then imports both files
        through the real import path.
      </p>
      <p>
        {SIZES.map((size) => (
          <button
            key={size}
            type="button"
            disabled={busy}
            onClick={() => void run(size)}
            data-size={size}
          >
            Generate and import {size.toLocaleString('en-GB')}
          </button>
        ))}{' '}
        <button
          type="button"
          disabled={busy}
          onClick={() => void clearCache().then(listCached).then(setEntries)}
        >
          Clear cache
        </button>
      </p>
      <p role="status" data-testid="status">
        {status}
      </p>
      {runs.map((entry, index) => (
        <table key={runs.length - index} data-testid="run">
          <caption>
            {entry.activities.toLocaleString('en-GB')} activities. Generated in{' '}
            {ms(entry.generateMs)}. {entry.slip}. Main thread long tasks: {entry.longTasks}
            {entry.longTasks > 0 ? ` (longest ${ms(entry.longestTaskMs)})` : ''}.
          </caption>
          <thead>
            <tr>
              <th>File</th>
              <th>Size</th>
              <th>Activities</th>
              <th>Relationships</th>
              <th>Warnings</th>
              <th>Data date</th>
              <th>Source</th>
              <th>Hash</th>
              <th>Parse</th>
              <th>Cache</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {entry.rows.map(({ label, megabytes, result }) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{megabytes.toFixed(1)}MB</td>
                <td>{result.data.n.toLocaleString('en-GB')}</td>
                <td>{result.data.meta.relationshipCount.toLocaleString('en-GB')}</td>
                <td>{result.data.meta.warnings.length}</td>
                <td>{formatXerDate(result.data.meta.dataDate)}</td>
                <td>
                  {result.fromCache
                    ? 'cache'
                    : result.cached
                      ? 'parsed, then cached'
                      : 'parsed, not cached'}
                </td>
                <td>{ms(result.timings.hashMs)}</td>
                <td>{ms(result.timings.parseMs)}</td>
                <td>{ms(result.timings.cacheMs)}</td>
                <td>{ms(result.timings.totalMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      <h3>Cached schedules</h3>
      <p data-testid="cache">
        {entries.length === 0
          ? 'None.'
          : `${entries.length} entries, ${(entries.reduce((total, entry) => total + entry.bytes, 0) / 1e6).toFixed(1)}MB.`}
      </p>
    </section>
  );
}
