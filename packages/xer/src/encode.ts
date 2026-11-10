/**
 * Packs a ScheduleData into one binary blob and back, for the browser cache.
 *
 * Layout: an 16 byte preamble (magic, format version, header length), a JSON
 * header, then every typed array back to back, each aligned to 8 bytes. In
 * the header each typed array is replaced by a small marker saying where its
 * bytes are. Decoding makes views over the one buffer and copies nothing,
 * so opening a cached million-activity schedule does no per-row work.
 */
import { FORMAT_VERSION, type ScheduleData } from './types.ts';

const MAGIC = 0x50494c53; // "SLIP", little-endian
const PREAMBLE = 16;

type ArrayKind = 'i32' | 'i16' | 'u8';
interface Marker {
  $array: ArrayKind;
  offset: number;
  length: number;
}

const align = (value: number) => (value + 7) & ~7;

function kindOf(value: ArrayBufferView): ArrayKind {
  if (value instanceof Int32Array) return 'i32';
  if (value instanceof Int16Array) return 'i16';
  if (value instanceof Uint8Array) return 'u8';
  throw new TypeError('ScheduleData holds a kind of typed array the cache format does not know.');
}

export class CacheFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheFormatError';
  }
}

export function encode(data: ScheduleData): Uint8Array<ArrayBuffer> {
  const arrays: ArrayBufferView[] = [];
  let bodyLength = 0;
  const strip = (value: unknown): unknown => {
    if (ArrayBuffer.isView(value)) {
      const marker: Marker = {
        $array: kindOf(value),
        offset: bodyLength,
        length: value.byteLength,
      };
      arrays.push(value);
      bodyLength = align(bodyLength + value.byteLength);
      return marker;
    }
    if (Array.isArray(value)) return value.map(strip);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, strip(inner)]));
    }
    return value;
  };
  const header = new TextEncoder().encode(JSON.stringify(strip(data)));
  const bodyStart = align(PREAMBLE + header.length);
  const out = new Uint8Array(bodyStart + bodyLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, FORMAT_VERSION, true);
  view.setUint32(8, header.length, true);
  out.set(header, PREAMBLE);
  let at = bodyStart;
  for (const array of arrays) {
    out.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), at);
    at = align(at + array.byteLength);
  }
  return out;
}

/** Rebuilds a ScheduleData as views over `buffer`. Throws CacheFormatError if it is not a current-version blob. */
export function decode(buffer: ArrayBuffer): ScheduleData {
  if (buffer.byteLength < PREAMBLE) throw new CacheFormatError('Cached schedule is too short.');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== MAGIC) throw new CacheFormatError('Not a cached schedule.');
  const version = view.getUint32(4, true);
  if (version !== FORMAT_VERSION) {
    throw new CacheFormatError(
      `Cached schedule is format ${version}; this build reads ${FORMAT_VERSION}.`,
    );
  }
  const headerLength = view.getUint32(8, true);
  const bodyStart = align(PREAMBLE + headerLength);
  if (bodyStart > buffer.byteLength) throw new CacheFormatError('Cached schedule is cut short.');

  const revive = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(revive);
    if (value !== null && typeof value === 'object') {
      const marker = value as Partial<Marker>;
      if (typeof marker.$array === 'string') {
        const offset = bodyStart + marker.offset!;
        const length = marker.length!;
        if (offset + length > buffer.byteLength)
          throw new CacheFormatError('Cached schedule is cut short.');
        if (marker.$array === 'i32') return new Int32Array(buffer, offset, length / 4);
        if (marker.$array === 'i16') return new Int16Array(buffer, offset, length / 2);
        return new Uint8Array(buffer, offset, length);
      }
      return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, revive(inner)]));
    }
    return value;
  };
  let header: unknown;
  try {
    header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, PREAMBLE, headerLength)));
  } catch {
    throw new CacheFormatError('Cached schedule has an unreadable header.');
  }
  return revive(header) as ScheduleData;
}
