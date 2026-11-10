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

export interface SlipPerfApi {
  /** Generates a synthetic pair and keeps the two files in memory. Returns the time taken. */
  prepare(activities: number): Promise<number>;
  /** Imports one of the prepared files through the real import path. */
  importPrepared(which: 0 | 1): Promise<PerfImport>;
  clearCache(): Promise<void>;
  /** Drops the prepared files and any imported schedules. */
  reset(): void;
}

declare global {
  interface Window {
    slipPerf?: SlipPerfApi;
  }
}
