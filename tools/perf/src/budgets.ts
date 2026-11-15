import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
/**
 * Budgets from docs/spec/performance.md, in milliseconds unless named
 * otherwise. Change them there first, with a decision record; never loosen
 * one here to make a run pass.
 */
export interface Budget {
  /** "Full parse complete": one file, from starting the import to holding the schedule. */
  fullImportMs: number;
  /** "Reopen from OPFS cache to first rows". There are no rows yet, so this is to holding the schedule. */
  reopenMs: number;
  /** "Main thread long tasks (> 50ms) during import". */
  longTasks: number;
  /** "JS heap + typed array memory after import (both updates)". A starting estimate; see the spec. */
  memoryMb: number;
  /** "CPM run (worker)". */
  cpmMs: number;
  /** "Diff of two updates". */
  diffMs: number;
  /** "First rows visible after file drop", measured as dropping both files to the summary's answer. */
  firstRowsMs: number;
  /** "Grid + Gantt scroll, p95 frame time". */
  frameMs: number;
}

export const BUDGETS: Record<number, Budget> = {
  100_000: {
    fullImportMs: 1500,
    reopenMs: 300,
    longTasks: 0,
    memoryMb: 250,
    cpmMs: 300,
    diffMs: 300,
    firstRowsMs: 1000,
    frameMs: 16.7,
  },
  350_000: {
    fullImportMs: 4000,
    reopenMs: 600,
    longTasks: 0,
    memoryMb: 700,
    cpmMs: 1000,
    diffMs: 1000,
    firstRowsMs: 2500,
    frameMs: 16.7,
  },
  1_000_000: {
    fullImportMs: 10000,
    reopenMs: 1500,
    longTasks: 0,
    memoryMb: 1800,
    cpmMs: 3000,
    diffMs: 3000,
    firstRowsMs: 6000,
    frameMs: 16.7,
  },
};

export interface Mode {
  name: 'ci' | 'local';
  sizes: number[];
  runs: number;
  /** Time budgets are multiplied by this. Shared CI runners are slow and noisy (decision D14). */
  timeFactor: number;
}

export const MODES: Record<'ci' | 'local', Mode> = {
  ci: { name: 'ci', sizes: [100_000], runs: 3, timeFactor: 2 },
  local: { name: 'local', sizes: [100_000, 350_000, 1_000_000], runs: 5, timeFactor: 1 },
};

export function currentMode(): Mode {
  return process.env.PERF_MODE === 'local' ? MODES.local : MODES.ci;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export interface SizeResult {
  activities: number;
  runs: number;
  fileMb: number;
  generateMs: number;
  /** Medians across runs, for one file. */
  fullImportMs: number;
  hashMs: number;
  parseMs: number;
  cacheWriteMs: number;
  reopenMs: number;
  /** The most long tasks seen in any single import, and the longest of them. */
  longTasks: number;
  longestTaskMs: number;
  /** With both updates loaded. */
  heapMb: number;
  bufferMb: number;
  memoryMb: number;
  /** Engine worker, single run, timed from the main thread. */
  engineLoadMs: number;
  cpmMs: number;
  diffMs: number;
  firstRowsMs: number;
  scrollRowsMs: number;
  searchMs: number;
  sortByCodeMs: number;
  engineLongTasks: number;
  /** The real screens (ui.perf.ts). Missing when that file was not run. */
  dropToSummaryMs?: number;
  summaryToRowsMs?: number;
  scrollP95Ms?: number;
  scrollFrames?: number;
  scrollLongTasks?: number;
  /** Only on the entry for 0 activities: the app shell's initial JavaScript, gzipped. */
  initialJsKb?: number;
}

export const RESULTS_FILE = 'test-results/perf-results.json';

/** "The initial JavaScript for the app shell is at most 250 KB compressed." */
export const BUNDLE_BUDGET_KB = 250;

/** Adds one size's results to the file, merged with anything another test wrote for that size. */
export function record(result: Partial<SizeResult> & { activities: number }): void {
  mkdirSync(dirname(RESULTS_FILE), { recursive: true });
  const all: SizeResult[] = existsSync(RESULTS_FILE)
    ? JSON.parse(readFileSync(RESULTS_FILE, 'utf8'))
    : [];
  const before = all.find((r) => r.activities === result.activities);
  writeFileSync(
    RESULTS_FILE,
    JSON.stringify(
      [...all.filter((r) => r.activities !== result.activities), { ...before, ...result }],
      null,
      2,
    ),
  );
}
