/** Messages between the main thread and the import and generate workers. */
import type { Expected, GenOptions } from '@slip/gen';
import type { ScheduleData, XerErrorCode } from '@slip/xer';

export type ImportPhase = 'hashing' | 'parsing' | 'caching';

export type ImportRequest =
  /** `projectId` picks a project when the file holds several. Left out, the first is read. */
  { type: 'import'; blob: Blob; projectId?: number } | { type: 'cancel' };

export interface ImportTimings {
  hashMs: number;
  /** Zero when the schedule came from the cache. */
  parseMs: number;
  /** Encoding and writing the cache entry, or reading and decoding it on a hit. */
  cacheMs: number;
  totalMs: number;
}

export type ImportErrorCode = XerErrorCode | 'cancelled' | 'out-of-memory' | 'failed';

export type ImportResponse =
  | {
      type: 'progress';
      phase: ImportPhase;
      rowsParsed: number;
      bytesRead: number;
      totalBytes: number;
    }
  | {
      type: 'done';
      data: ScheduleData;
      fromCache: boolean;
      cached: boolean;
      timings: ImportTimings;
    }
  | { type: 'error'; code: ImportErrorCode; message: string };

export type GenerateRequest = { type: 'generate'; options: GenOptions };

export type GenerateResponse =
  | { type: 'done'; update01: Blob; update02: Blob; expected: Expected; generateMs: number }
  | { type: 'error'; message: string };
