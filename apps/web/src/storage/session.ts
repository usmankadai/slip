/**
 * Which pair of updates is open. A reload throws away the schedules held by the engine
 * worker; with this, the app can read them back from the OPFS cache and reopen the pair.
 */
import type { SlotFacts } from '../features/import/types.ts';
import { SESSION, run } from './db.ts';

const KEY = 'open-pair';

interface Saved {
  version: 1;
  a: SlotFacts;
  b: SlotFacts;
}

const isFacts = (value: unknown): value is SlotFacts => {
  if (typeof value !== 'object' || value === null) return false;
  const facts = value as Record<string, unknown>;
  return (
    typeof facts.sourceHash === 'string' &&
    /^[0-9a-f]{64}$/.test(facts.sourceHash) &&
    Number.isSafeInteger(facts.projectId) &&
    typeof facts.fileName === 'string' &&
    typeof facts.projectName === 'string' &&
    Number.isFinite(facts.dataDate) &&
    Number.isFinite(facts.activities) &&
    typeof facts.report === 'object' &&
    facts.report !== null
  );
};

export async function saveOpenPair(
  pair: { a: SlotFacts; b: SlotFacts },
  factory?: IDBFactory,
): Promise<boolean> {
  const saved: Saved = { version: 1, a: pair.a, b: pair.b };
  return (await run(factory, SESSION, 'readwrite', (store) => store.put(saved, KEY))) !== null;
}

/** The pair that was open, or null when none was, or what was saved cannot be read. */
export async function loadOpenPair(
  factory?: IDBFactory,
): Promise<{ a: SlotFacts; b: SlotFacts } | null> {
  const saved = (await run(factory, SESSION, 'readonly', (store) => store.get(KEY))) as unknown;
  if (typeof saved !== 'object' || saved === null) return null;
  const { version, a, b } = saved as Partial<Saved>;
  return version === 1 && isFacts(a) && isFacts(b) ? { a, b } : null;
}

/** Forgets the open pair, when the planner goes back to import. */
export async function clearOpenPair(factory?: IDBFactory): Promise<void> {
  await run(factory, SESSION, 'readwrite', (store) => store.delete(KEY));
}
