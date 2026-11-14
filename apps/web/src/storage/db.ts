/**
 * The browser database for work that must survive a reload: the narrative and
 * the audit log (persistence spec). Everything here fails soft: a browser with
 * no IndexedDB, a private window or a full disk means "not saved", never a
 * broken screen.
 */

const NAME = 'slip';
const VERSION = 2;
export const NARRATIVES = 'narratives';
export const AUDIT = 'audit';
/** Which pair of updates was open, so a reload can reopen it. Version 2. */
export const SESSION = 'session';

/** The factory is a parameter so tests can pass an in-memory one. */
export function openDb(
  factory: IDBFactory | undefined = globalThis.indexedDB,
): Promise<IDBDatabase | null> {
  if (!factory) return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(NAME, VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NARRATIVES)) db.createObjectStore(NARRATIVES);
      if (!db.objectStoreNames.contains(SESSION)) db.createObjectStore(SESSION);
      if (!db.objectStoreNames.contains(AUDIT)) {
        const audit = db.createObjectStore(AUDIT, { keyPath: 'id', autoIncrement: true });
        audit.createIndex('pair', 'pair');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/** Runs one request in a transaction and resolves with its result, or null if anything fails. */
export async function run<T>(
  factory: IDBFactory | undefined,
  store: string,
  mode: IDBTransactionMode,
  make: (objects: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb(factory);
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(store, mode);
      const request = make(transaction.objectStore(store));
      let result: T | null = null;
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };
      transaction.onerror = () => {
        db.close();
        resolve(null);
      };
      transaction.onabort = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/**
 * The key for a pair of updates. The same file can hold several projects, so the project
 * read from each file is part of the key.
 */
export function pairKey(
  a: { sourceHash: string; projectId: number },
  b: { sourceHash: string; projectId: number },
): string {
  return `${a.sourceHash}-p${a.projectId}:${b.sourceHash}-p${b.projectId}`;
}

/** Asks the browser not to clear Slip's storage under pressure. Resolves with whether it agreed. */
export async function askToPersist(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
