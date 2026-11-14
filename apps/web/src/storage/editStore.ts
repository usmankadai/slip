/** Changes the planner approved, saved per pair so they are replayed when the pair is opened again. */
import { EDITS, run } from './db.ts';

export type SavedField =
  'originalDuration' | 'remainingDuration' | 'constraintType' | 'constraintDate';

export interface SavedEdit {
  /** The engine's id for the edit, reused when it is replayed. */
  id: string;
  taskCode: string;
  field: SavedField;
  to: number;
  /** A second value applied with the first: a constraint is a type and a date. */
  and?: { field: SavedField; to: number };
  reason: string;
}

const FIELDS = new Set([
  'originalDuration',
  'remainingDuration',
  'constraintType',
  'constraintDate',
]);
const isEdit = (value: unknown): value is SavedEdit => {
  if (typeof value !== 'object' || value === null) return false;
  const edit = value as Record<string, unknown>;
  const and = edit.and as Record<string, unknown> | undefined;
  return (
    typeof edit.id === 'string' &&
    edit.id.length <= 100 &&
    typeof edit.taskCode === 'string' &&
    FIELDS.has(edit.field as string) &&
    Number.isSafeInteger(edit.to) &&
    typeof edit.reason === 'string' &&
    (and === undefined || (FIELDS.has(and.field as string) && Number.isSafeInteger(and.to)))
  );
};

export async function saveEdits(
  pair: string,
  edits: SavedEdit[],
  factory?: IDBFactory,
): Promise<boolean> {
  return (
    (await run(factory, EDITS, 'readwrite', (store) => store.put({ version: 1, edits }, pair))) !==
    null
  );
}

/** The saved edits in the order they were approved; an empty list when there are none or they cannot be read. */
export async function loadEdits(pair: string, factory?: IDBFactory): Promise<SavedEdit[]> {
  const saved = (await run(factory, EDITS, 'readonly', (store) => store.get(pair))) as unknown;
  if (typeof saved !== 'object' || saved === null) return [];
  const { version, edits } = saved as { version?: unknown; edits?: unknown };
  return version === 1 && Array.isArray(edits) ? edits.filter(isEdit) : [];
}
