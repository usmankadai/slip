import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Block } from '../features/narrative/model.ts';
import { appendAudit, listAudit } from './auditLog.ts';
import { openDb, pairKey } from './db.ts';
import { loadNarrative, saveNarrative } from './narrativeStore.ts';

beforeAll(() => {
  // The audit log builds a key range; the fake factory needs its own.
  globalThis.IDBKeyRange ??= IDBKeyRange as unknown as typeof globalThis.IDBKeyRange;
});

const block = (id: string, text: string): Block => ({
  id,
  title: 'Key dates',
  generated: 'A moved.',
  text,
  evidence: [{ type: 'activity', code: 'MS-COMPLETE' }],
  source: 'generated',
});

describe('pairKey', () => {
  it('includes the project read from each file', () => {
    expect(pairKey({ sourceHash: 'aa', projectId: 1 }, { sourceHash: 'bb', projectId: 2 })).toBe(
      'aa-p1:bb-p2',
    );
    expect(
      pairKey({ sourceHash: 'aa', projectId: 1 }, { sourceHash: 'bb', projectId: 3 }),
    ).not.toBe('aa-p1:bb-p2');
  });
});

describe('narrative store', () => {
  it('saves paragraphs for a pair and reads them back', async () => {
    const factory = new IDBFactory();
    const blocks = [
      block('dates', 'A moved, as expected.'),
      { ...block('own-1', 'Our note.'), source: 'own' as const },
    ];
    expect(await saveNarrative('p1', blocks, factory)).toBe(true);
    expect(await loadNarrative('p1', factory)).toEqual(blocks);
    expect(await loadNarrative('p2', factory)).toBeNull();
  });

  it('replaces the saved paragraphs on each save', async () => {
    const factory = new IDBFactory();
    await saveNarrative('p1', [block('dates', 'first')], factory);
    await saveNarrative('p1', [block('dates', 'second')], factory);
    expect((await loadNarrative('p1', factory))?.[0]?.text).toBe('second');
  });

  it('ignores something saved that is not a narrative', async () => {
    const factory = new IDBFactory();
    const db = (await openDb(factory))!;
    await new Promise<void>((resolve) => {
      const transaction = db.transaction('narratives', 'readwrite');
      transaction.objectStore('narratives').put({ version: 1, blocks: [{ id: 1 }] }, 'bad');
      transaction.objectStore('narratives').put('not an object', 'worse');
      transaction.oncomplete = () => resolve();
    });
    db.close();
    expect(await loadNarrative('bad', factory)).toBeNull();
    expect(await loadNarrative('worse', factory)).toBeNull();
  });

  it('does nothing, without failing, when there is no database', async () => {
    expect(await saveNarrative('p1', [], undefined as unknown as IDBFactory)).toBe(
      globalThis.indexedDB === undefined ? false : true,
    );
    const broken = {
      open: () => {
        throw new Error('denied');
      },
    } as unknown as IDBFactory;
    expect(await saveNarrative('p1', [], broken)).toBe(false);
    expect(await loadNarrative('p1', broken)).toBeNull();
  });
});

describe('audit log', () => {
  it('keeps entries per pair, newest first', async () => {
    const factory = new IDBFactory();
    await appendAudit(
      { pair: 'p1', at: 100, actor: 'user', type: 'compared', summary: 'Compared A and B.' },
      factory,
    );
    await appendAudit(
      { pair: 'p2', at: 150, actor: 'user', type: 'compared', summary: 'Another pair.' },
      factory,
    );
    await appendAudit(
      { pair: 'p1', at: 200, actor: 'user', type: 'narrative-exported', summary: 'Exported.' },
      factory,
    );
    const entries = await listAudit('p1', factory);
    expect(entries?.map((entry) => entry.summary)).toEqual(['Exported.', 'Compared A and B.']);
    expect(entries?.every((entry) => typeof entry.id === 'number')).toBe(true);
  });

  it('keeps two entries made in the same millisecond, in the order they were made', async () => {
    const factory = new IDBFactory();
    await appendAudit(
      { pair: 'p1', at: 5, actor: 'user', type: 'narrative-added', summary: 'first' },
      factory,
    );
    await appendAudit(
      { pair: 'p1', at: 5, actor: 'user', type: 'narrative-removed', summary: 'second' },
      factory,
    );
    expect((await listAudit('p1', factory))?.map((entry) => entry.summary)).toEqual([
      'second',
      'first',
    ]);
  });

  it('stamps an entry with the time when none is given', async () => {
    const factory = new IDBFactory();
    const before = Date.now();
    await appendAudit({ pair: 'p1', actor: 'user', type: 'compared', summary: 'x' }, factory);
    expect((await listAudit('p1', factory))![0]!.at).toBeGreaterThanOrEqual(before);
  });

  it('says it cannot read the log when there is no database', async () => {
    const broken = {
      open: () => {
        throw new Error('denied');
      },
    } as unknown as IDBFactory;
    expect(
      await appendAudit({ pair: 'p1', actor: 'user', type: 'compared', summary: 'x' }, broken),
    ).toBe(false);
    expect(await listAudit('p1', broken)).toBeNull();
  });
});
