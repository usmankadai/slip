import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Block } from '../features/narrative/model.ts';
import { appendAudit, listAudit } from './auditLog.ts';
import { openDb, pairKey } from './db.ts';
import { loadNarrative, saveNarrative } from './narrativeStore.ts';
import { clearOpenPair, loadOpenPair, saveOpenPair } from './session.ts';
import { loadEdits, saveEdits } from './editStore.ts';
import type { SlotFacts } from '../features/import/types.ts';

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

describe('open pair', () => {
  const facts = (hash: string): SlotFacts => ({
    fileName: 'a.xer',
    projectName: 'Northern Rail',
    projectId: 1,
    dataDate: 0,
    activities: 1000,
    relationships: 1200,
    sourceHash: hash.repeat(64),
    projects: [],
    incomplete: false,
    incompleteAccepted: false,
    report: { total: 0, kinds: 0, groups: [] },
  });

  it('remembers the open pair and forgets it', async () => {
    const factory = new IDBFactory();
    const pair = { a: facts('a'), b: facts('b') };
    expect(await saveOpenPair(pair, factory)).toBe(true);
    expect(await loadOpenPair(factory)).toEqual(pair);
    await clearOpenPair(factory);
    expect(await loadOpenPair(factory)).toBeNull();
  });

  it('ignores a saved pair that is not one', async () => {
    const factory = new IDBFactory();
    await saveOpenPair({ a: { ...facts('a'), sourceHash: '../x' }, b: facts('b') }, factory);
    expect(await loadOpenPair(factory)).toBeNull();
    await saveOpenPair({ a: facts('a'), b: { ...facts('b'), projectId: 1.5 } }, factory);
    expect(await loadOpenPair(factory)).toBeNull();
  });
});

describe('edit store', () => {
  const edit = {
    id: 'edit-1',
    taskCode: 'ENB-0110',
    field: 'originalDuration' as const,
    to: 9600,
    reason: 'It grew.',
  };

  it('saves the approved edits for a pair, in order', async () => {
    const factory = new IDBFactory();
    const constraint = {
      ...edit,
      id: 'edit-2',
      field: 'constraintType' as const,
      to: 2,
      and: { field: 'constraintDate' as const, to: 1000 },
    };
    expect(await saveEdits('p1', [edit, constraint], factory)).toBe(true);
    expect(await loadEdits('p1', factory)).toEqual([edit, constraint]);
    expect(await loadEdits('p2', factory)).toEqual([]);
  });

  it('leaves out anything saved that is not an edit', async () => {
    const factory = new IDBFactory();
    await saveEdits(
      'p1',
      [edit, { ...edit, field: 'name' } as never, { ...edit, to: 1.5 }],
      factory,
    );
    expect(await loadEdits('p1', factory)).toEqual([edit]);
  });
});
