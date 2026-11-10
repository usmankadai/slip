/**
 * Import worker. Reads a file as a stream, never as one string:
 *   1. hash it (SHA-256), to look for a cached copy
 *   2. on a miss, stream it again through the windows-1252 decoder and the parser
 *   3. pack the result into one buffer, write it to the cache, and transfer it back
 *
 * Reading the file twice costs about a second at 1M activities and saves the
 * whole parse on every later open of the same file.
 */
import { Sha256, XerError, XerParser, decode, encode } from '@slip/xer';
import { readCached, writeCached } from '../storage/scheduleCache.ts';
import type { ImportErrorCode, ImportPhase, ImportRequest, ImportResponse } from './protocol.ts';

const PROGRESS_INTERVAL_MS = 100;

let cancelled = false;

function send(message: ImportResponse, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer });
}

class Cancelled extends Error {}

async function run(blob: Blob): Promise<void> {
  const started = performance.now();
  const totalBytes = blob.size;
  let lastProgress = 0;
  const progress = (phase: ImportPhase, rowsParsed: number, bytesRead: number, force = false) => {
    const now = performance.now();
    if (!force && now - lastProgress < PROGRESS_INTERVAL_MS) return;
    lastProgress = now;
    send({ type: 'progress', phase, rowsParsed, bytesRead, totalBytes });
  };
  const chunks = async (
    each: (bytes: Uint8Array) => void,
    phase: ImportPhase,
    rows: () => number,
  ) => {
    const reader = blob.stream().getReader();
    let bytesRead = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (cancelled) {
        await reader.cancel();
        throw new Cancelled();
      }
      each(value);
      bytesRead += value.length;
      progress(phase, rows(), bytesRead);
    }
    progress(phase, rows(), bytesRead, true);
  };

  const hasher = new Sha256();
  await chunks(
    (bytes) => hasher.update(bytes),
    'hashing',
    () => 0,
  );
  const hash = hasher.hex();
  const hashed = performance.now();

  const cachedBuffer = await readCached(hash);
  if (cachedBuffer) {
    try {
      const data = decode(cachedBuffer);
      const now = performance.now();
      send(
        {
          type: 'done',
          data,
          fromCache: true,
          cached: true,
          timings: {
            hashMs: hashed - started,
            parseMs: 0,
            cacheMs: now - hashed,
            totalMs: now - started,
          },
        },
        [cachedBuffer],
      );
      return;
    } catch {
      // An unreadable entry is treated as a miss and overwritten below.
    }
  }

  const parser = new XerParser();
  const decoder = new TextDecoder('windows-1252');
  const parseStarted = performance.now();
  await chunks(
    (bytes) => parser.push(decoder.decode(bytes, { stream: true })),
    'parsing',
    () => parser.rowsParsed,
  );
  parser.push(decoder.decode());
  const parsed = parser.finish();
  parsed.meta.sourceHash = hash;
  const parseDone = performance.now();

  progress('caching', parser.rowsParsed, totalBytes, true);
  const packed = encode(parsed);
  const cached = await writeCached(hash, packed);
  // Hand back views over the packed buffer: one transfer, and the parser's own arrays can be freed.
  const data = decode(packed.buffer);
  const now = performance.now();
  send(
    {
      type: 'done',
      data,
      fromCache: false,
      cached,
      timings: {
        hashMs: hashed - started,
        parseMs: parseDone - parseStarted,
        cacheMs: now - parseDone,
        totalMs: now - started,
      },
    },
    [packed.buffer],
  );
}

self.onmessage = (event: MessageEvent<ImportRequest>) => {
  if (event.data.type === 'cancel') {
    cancelled = true;
    return;
  }
  run(event.data.blob).catch((error: unknown) => {
    let code: ImportErrorCode = 'failed';
    let message = 'The file could not be imported.';
    if (error instanceof Cancelled) {
      code = 'cancelled';
      message = 'Import cancelled.';
    } else if (error instanceof XerError) {
      code = error.code;
      message = error.message;
    } else if (error instanceof RangeError) {
      code = 'out-of-memory';
      message = 'There was not enough memory to import this file. Closing other tabs may help.';
    }
    send({ type: 'error', code, message });
  });
};
