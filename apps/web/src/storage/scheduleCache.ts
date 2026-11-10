/**
 * The browser cache of parsed schedules, in the Origin Private File System.
 * One file per schedule: schedules/<sha256 of the source file>-v<format>.bin
 *
 * Every function here fails soft. A browser with no OPFS, a private window
 * or a full disk means "no cache", never a broken import.
 */
import { FORMAT_VERSION } from '@slip/xer';

const FOLDER = 'schedules';
const SUFFIX = `-v${FORMAT_VERSION}.bin`;

interface SyncHandle {
  write(bytes: Uint8Array): number;
  flush(): void;
  close(): void;
}

async function folder(create: boolean): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(FOLDER, { create });
}

export async function readCached(hash: string): Promise<ArrayBuffer | null> {
  try {
    const handle = await (await folder(false)).getFileHandle(hash + SUFFIX);
    return await (await handle.getFile()).arrayBuffer();
  } catch {
    return null;
  }
}

/** Returns false if the entry could not be written (no OPFS, no space). */
export async function writeCached(hash: string, bytes: Uint8Array<ArrayBuffer>): Promise<boolean> {
  try {
    const handle = await (await folder(true)).getFileHandle(hash + SUFFIX, { create: true });
    // Inside a worker the synchronous handle is the widely supported way to write.
    const sync = (handle as unknown as { createSyncAccessHandle?: () => Promise<SyncHandle> })
      .createSyncAccessHandle;
    if (typeof sync === 'function') {
      const access = await sync.call(handle);
      try {
        access.write(bytes);
        access.flush();
      } finally {
        access.close();
      }
    } else {
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
    }
    return true;
  } catch {
    await removeCached(hash + SUFFIX);
    return false;
  }
}

export interface CacheEntry {
  name: string;
  bytes: number;
  /** False for entries written by an older format, which this build cannot read. */
  current: boolean;
}

export async function listCached(): Promise<CacheEntry[]> {
  try {
    const entries: CacheEntry[] = [];
    const directory = await folder(false);
    for await (const [name, handle] of directory as unknown as AsyncIterable<
      [string, FileSystemHandle]
    >) {
      if (handle.kind !== 'file') continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      entries.push({ name, bytes: file.size, current: name.endsWith(SUFFIX) });
    }
    return entries.sort((a, b) => (a.name < b.name ? -1 : 1));
  } catch {
    return [];
  }
}

export async function removeCached(name: string): Promise<void> {
  try {
    await (await folder(false)).removeEntry(name);
  } catch {
    // Already gone, or no cache at all.
  }
}

/** Deletes entries written by older formats. Call once at start-up. */
export async function removeStale(): Promise<number> {
  const stale = (await listCached()).filter((entry) => !entry.current);
  for (const entry of stale) await removeCached(entry.name);
  return stale.length;
}

export async function clearCache(): Promise<void> {
  try {
    await (await navigator.storage.getDirectory()).removeEntry(FOLDER, { recursive: true });
  } catch {
    // Nothing to clear.
  }
}
