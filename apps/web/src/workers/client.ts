/** Promise wrappers around the import and generate workers. One worker per job; it is terminated when done. */
import type { Expected, GenOptions } from '@slip/gen';
import type { ScheduleData } from '@slip/xer';
import type {
  GenerateRequest,
  GenerateResponse,
  ImportErrorCode,
  ImportRequest,
  ImportResponse,
  ImportTimings,
} from './protocol.ts';

export class ImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode, message: string) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

export interface ImportResult {
  data: ScheduleData;
  fromCache: boolean;
  cached: boolean;
  timings: ImportTimings;
}

export type ProgressEvent = Extract<ImportResponse, { type: 'progress' }>;

export function importSchedule(
  blob: Blob,
  onProgress?: (event: ProgressEvent) => void,
  signal?: AbortSignal,
  projectId?: number,
): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      signal?.removeEventListener('abort', cancel);
      worker.terminate();
    };
    const cancel = () => worker.postMessage({ type: 'cancel' } satisfies ImportRequest);
    signal?.addEventListener('abort', cancel);
    worker.onmessage = (event: MessageEvent<ImportResponse>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress?.(message);
      } else if (message.type === 'done') {
        finish();
        resolve(message);
      } else {
        finish();
        reject(new ImportError(message.code, message.message));
      }
    };
    worker.onerror = () => {
      finish();
      reject(new ImportError('failed', 'The import worker stopped unexpectedly.'));
    };
    worker.postMessage({
      type: 'import',
      blob,
      ...(projectId === undefined ? {} : { projectId }),
    } satisfies ImportRequest);
  });
}

export interface GeneratedPair {
  update01: Blob;
  update02: Blob;
  expected: Expected;
  generateMs: number;
}

export function generateSchedules(options: GenOptions): Promise<GeneratedPair> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./generate.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<GenerateResponse>) => {
      worker.terminate();
      if (event.data.type === 'done') resolve(event.data);
      else reject(new Error(event.data.message));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('The generate worker stopped unexpectedly.'));
    };
    worker.postMessage({ type: 'generate', options } satisfies GenerateRequest);
  });
}
