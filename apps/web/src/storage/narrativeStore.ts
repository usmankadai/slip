/** The narrative's paragraphs, saved per pair of updates so edits survive a reload. */
import type { Block } from '../features/narrative/model.ts';
import { NARRATIVES, run } from './db.ts';

interface Saved {
  version: 1;
  blocks: Block[];
}

const isBlock = (value: unknown): value is Block => {
  if (typeof value !== 'object' || value === null) return false;
  const block = value as Record<string, unknown>;
  return (
    typeof block.id === 'string' &&
    typeof block.title === 'string' &&
    typeof block.generated === 'string' &&
    typeof block.text === 'string' &&
    Array.isArray(block.evidence) &&
    (block.source === 'generated' || block.source === 'own')
  );
};

/** Resolves false when it could not be saved. */
export async function saveNarrative(
  pair: string,
  blocks: Block[],
  factory?: IDBFactory,
): Promise<boolean> {
  const saved: Saved = { version: 1, blocks };
  return (await run(factory, NARRATIVES, 'readwrite', (store) => store.put(saved, pair))) !== null;
}

/** The saved paragraphs, or null when there are none or what was saved cannot be read. */
export async function loadNarrative(pair: string, factory?: IDBFactory): Promise<Block[] | null> {
  const saved = (await run(factory, NARRATIVES, 'readonly', (store) => store.get(pair))) as unknown;
  if (typeof saved !== 'object' || saved === null) return null;
  const { version, blocks } = saved as Partial<Saved>;
  if (version !== 1 || !Array.isArray(blocks) || !blocks.every(isBlock)) return null;
  return blocks;
}
