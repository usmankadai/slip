/** Wording for a file that cannot be read at all. Three parts: what happened, how Slip knows, what to do. */
import type { ImportErrorCode } from '../../workers/protocol.ts';
import { megabytes } from './format.ts';
import { MAX_FILE_BYTES } from './types.ts';

export interface ErrorCopy {
  title: string;
  detail: string;
  /** True when trying the same file again could work. */
  retry: boolean;
}

export function errorCopy(code: ImportErrorCode | 'too-large', fileName: string): ErrorCopy {
  switch (code) {
    case 'not-xer':
      return {
        title: 'This is not an XER file',
        detail: `${fileName} does not start with the ERMHDR line that every P6 export has. Export the schedule from P6 as XER and try again.`,
        retry: false,
      };
    case 'empty':
      return {
        title: 'This file is empty',
        detail: `${fileName} has nothing in it. Export the schedule from P6 again.`,
        retry: false,
      };
    case 'too-large':
      return {
        title: 'This file is larger than Slip can read',
        detail: `${fileName} is over the limit of ${megabytes(MAX_FILE_BYTES)} MB.`,
        retry: false,
      };
    case 'out-of-memory':
      return {
        title: 'There was not enough memory to read this file',
        detail: `Slip ran out of memory part way through ${fileName}. Closing other tabs may help.`,
        retry: true,
      };
    default:
      return {
        title: 'Slip could not finish reading this file',
        detail: `Something went wrong while reading ${fileName}. The file itself may be fine.`,
        retry: true,
      };
  }
}

/** Checks made before any byte is read. Returns the error to show, or null to go ahead. */
export function rejectBeforeReading(file: { name: string; size: number }): ErrorCopy | null {
  if (file.size === 0) return errorCopy('empty', file.name);
  if (file.size > MAX_FILE_BYTES) return errorCopy('too-large', file.name);
  return null;
}
