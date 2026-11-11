/** What the import screen shows. Small values only: schedules stay in the workers (D3). */
import type { ProjectInfo } from '@slip/xer';
import type { PairCheck } from './pair.ts';
import type { Report } from './warnings.ts';

export type SlotId = 'a' | 'b';

export interface SlotFacts {
  fileName: string;
  projectName: string;
  projectId: number;
  dataDate: number;
  activities: number;
  relationships: number;
  sourceHash: string;
  /** Every project in the file. More than one means the planner may need to choose. */
  projects: ProjectInfo[];
  /** The file ended without its closing line. */
  incomplete: boolean;
  /** The planner chose to use an incomplete file as it is. */
  incompleteAccepted: boolean;
  report: Report;
}

export type SlotState =
  | { status: 'empty' }
  | {
      status: 'loading';
      fileName: string;
      phase: 'generating' | 'hashing' | 'parsing' | 'caching' | 'loading';
      rows: number;
      bytesRead: number;
      totalBytes: number;
    }
  | { status: 'error'; fileName: string; title: string; detail: string; retry: boolean }
  | { status: 'ready'; facts: SlotFacts };

export type PairState =
  | { status: 'absent' }
  | { status: 'checking' }
  | { status: 'failed' }
  | { status: 'checked'; check: PairCheck };

export interface ImportState {
  a: SlotState;
  b: SlotState;
  pair: PairState;
  generating: boolean;
}

/** Largest file the import will read (docs/spec/security.md). */
export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

export const EMPTY_STATE: ImportState = {
  a: { status: 'empty' },
  b: { status: 'empty' },
  pair: { status: 'absent' },
  generating: false,
};

/** Why Compare updates cannot be pressed yet, or '' when it can. */
export function compareBlocker(state: ImportState): string {
  for (const id of ['a', 'b'] as const) {
    const slot = state[id];
    const name = `update ${id.toUpperCase()}`;
    if (slot.status === 'empty' || slot.status === 'error') return `Needs ${name}`;
    if (slot.status === 'loading') return `Waiting for ${name}`;
    if (slot.facts.incomplete && !slot.facts.incompleteAccepted) {
      return `Waiting for an answer about ${name}`;
    }
  }
  if (state.pair.status === 'checking' || state.pair.status === 'absent') {
    return 'Checking the two updates';
  }
  if (state.pair.status === 'checked' && state.pair.check.blocks) return 'Nothing to compare';
  return '';
}
