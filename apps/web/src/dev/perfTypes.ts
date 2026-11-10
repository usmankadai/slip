/**
 * The page-side API the perf suite drives (tools/perf). Types only, with no
 * imports, so the suite can share them without pulling in the app.
 */
export interface PerfImport {
  /** Wall time on the main thread from starting the import to holding the result. */
  wallMs: number;
  hashMs: number;
  parseMs: number;
  cacheMs: number;
  fromCache: boolean;
  cached: boolean;
  activities: number;
  relationships: number;
  warnings: number;
  fileBytes: number;
  /** Bytes of typed-array memory the imported schedule holds on the main thread. */
  bufferBytes: number;
  /** Main-thread tasks over 50ms seen while this import ran. */
  longTasks: number[];
}

export interface PerfEngine {
  /** Transferring both schedules into the engine worker and preparing their calendars. */
  loadMs: number;
  /** One CPM run on update B, as seen from the main thread. */
  cpmMs: number;
  diffMs: number;
  /** The first screenful of the changed-activities view, sorted by slip: builds and caches the view. */
  firstRowsMs: number;
  /** A later screenful of the same view, served from the cached view. */
  scrollRowsMs: number;
  /** A text search over every code and name. */
  searchMs: number;
  /** Sorting every activity by code. */
  sortByCodeMs: number;
  changed: number;
  activities: number;
  differsFromFile: number;
  /** Main-thread tasks over 50ms seen while the engine worked. */
  longTasks: number[];
}

export interface SlipPerfApi {
  /** Generates a synthetic pair and keeps the two files in memory. Returns the time taken. */
  prepare(activities: number): Promise<number>;
  /** Imports one of the prepared files through the real import path. */
  importPrepared(which: 0 | 1): Promise<PerfImport>;
  /** Moves both imported schedules into the engine worker and times its main operations. Import both files first. */
  engine(): Promise<PerfEngine>;
  clearCache(): Promise<void>;
  /** Drops the prepared files and any imported schedules. */
  reset(): void;
}

declare global {
  interface Window {
    slipPerf?: SlipPerfApi;
  }
}
