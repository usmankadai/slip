/**
 * The audit log: what was done to a pair of updates, and by whom. Entries are only
 * ever added, never changed or removed (persistence spec).
 */
import { AUDIT, run } from './db.ts';

export type AuditType =
  | 'compared'
  | 'incomplete-used'
  | 'narrative-edited'
  | 'narrative-restored'
  | 'narrative-added'
  | 'narrative-removed'
  | 'narrative-exported'
  | 'agent-answer'
  | 'agent-proposal'
  | 'edit-approved'
  | 'edit-rejected'
  | 'edit-undone';

export interface AuditEntry {
  id?: number;
  pair: string;
  /** Milliseconds since 1970, from the planner's clock. */
  at: number;
  actor: 'user' | 'agent';
  type: AuditType;
  /** What happened, in a sentence. */
  summary: string;
}

/** Resolves false when the entry could not be written. */
export async function appendAudit(
  entry: Omit<AuditEntry, 'id' | 'at'> & { at?: number },
  factory?: IDBFactory,
): Promise<boolean> {
  const record: AuditEntry = { ...entry, at: entry.at ?? Date.now() };
  return (await run(factory, AUDIT, 'readwrite', (store) => store.add(record))) !== null;
}

/** Every entry for a pair, newest first, or null when the log cannot be read. */
export async function listAudit(pair: string, factory?: IDBFactory): Promise<AuditEntry[] | null> {
  const entries = await run(factory, AUDIT, 'readonly', (store) =>
    store.index('pair').getAll(IDBKeyRange.only(pair)),
  );
  if (entries === null) return null;
  return (entries as AuditEntry[]).slice().sort((x, y) => y.at - x.at || (y.id ?? 0) - (x.id ?? 0));
}
