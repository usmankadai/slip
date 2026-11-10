/**
 * Builds a synthetic pair of updates in the browser and hands them back as
 * two Blobs of XER text, exactly the bytes the gen-xer CLI would write. The
 * import worker then reads them like any dropped file, so this path
 * exercises the real parser.
 */
import { generatePair, writeXer, type Update } from '@slip/gen';
import type { GenerateRequest, GenerateResponse } from './protocol.ts';

function toBlob(update: Update): Blob {
  const encoder = new TextEncoder();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  // The generator only emits ASCII, so UTF-8 bytes are also valid windows-1252.
  writeXer(update, (chunk) => parts.push(encoder.encode(chunk)));
  return new Blob(parts, { type: 'text/plain' });
}

self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  let response: GenerateResponse;
  try {
    const started = performance.now();
    const pair = generatePair(event.data.options);
    response = {
      type: 'done',
      update01: toBlob(pair.update01),
      update02: toBlob(pair.update02),
      expected: pair.expected,
      generateMs: performance.now() - started,
    };
  } catch (error) {
    response = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Generation failed.',
    };
  }
  self.postMessage(response);
};
