import { describe, expect, it } from 'vitest';
import {
  CacheFormatError,
  Sha256,
  decode,
  encode,
  getTransferList,
  parseXerText,
  stringAt,
} from '../src/index.ts';
import { buildXer } from './fixture.ts';

describe('encode and decode', () => {
  const data = parseXerText(buildXer());
  const blob = encode(data);

  it('round trips a schedule exactly', () => {
    expect(decode(blob.buffer)).toEqual(data);
  });

  it('decodes to views over the one buffer, so nothing is copied and one buffer transfers', () => {
    const back = decode(blob.slice().buffer);
    expect(getTransferList(back).length).toBe(1);
    expect(back.earlyStart.buffer).toBe(back.taskCode.buffer);
    expect(stringAt(back.strings, back.taskName[1]!)).toBe('Détail design – café');
  });

  it('keeps every array aligned for its element size', () => {
    const back = decode(blob.buffer);
    expect(back.earlyStart.byteOffset % 4).toBe(0);
    expect(back.calendarIndex.byteOffset % 2).toBe(0);
    expect(back.calendars.calendars[0]!.exceptionDays).toBeInstanceOf(Int32Array);
  });

  it('refuses blobs that are not ours, are cut short, or are another version', () => {
    expect(() => decode(new ArrayBuffer(4))).toThrowError(CacheFormatError);
    expect(() => decode(new Uint8Array(64).buffer)).toThrowError(CacheFormatError);
    expect(() => decode(blob.slice(0, blob.length - 64).buffer)).toThrowError(CacheFormatError);
    expect(() => decode(blob.slice(0, 40).buffer)).toThrowError(CacheFormatError);
    const future = blob.slice();
    new DataView(future.buffer).setUint32(4, 999, true);
    expect(() => decode(future.buffer)).toThrowError(/format 999/);
    const garbled = blob.slice();
    garbled.fill(0x7b, 16, 40);
    expect(() => decode(garbled.buffer)).toThrowError(CacheFormatError);
  });
});

describe('Sha256', () => {
  const hex = async (bytes: Uint8Array<ArrayBuffer>) =>
    Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');

  it('matches the published test vectors', () => {
    expect(new Sha256().hex()).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(new Sha256().update(new TextEncoder().encode('abc')).hex()).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches Web Crypto for every length around the block boundaries', async () => {
    for (const length of [1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000]) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 131 + 7) & 0xff);
      expect(new Sha256().update(bytes).hex(), `length ${length}`).toBe(await hex(bytes));
    }
  });

  it('gives the same answer however the input is split', async () => {
    const bytes = Uint8Array.from({ length: 100_003 }, (_, i) => (i * 2654435761) >>> 24);
    const want = await hex(bytes);
    for (const size of [1, 3, 63, 64, 65, 4096, 100_003]) {
      const hash = new Sha256();
      for (let at = 0; at < bytes.length; at += size) hash.update(bytes.subarray(at, at + size));
      expect(hash.hex(), `chunks of ${size}`).toBe(want);
    }
  });

  it('can be read twice but not added to after finishing', () => {
    const hash = new Sha256().update(new Uint8Array(10));
    expect(hash.hex()).toBe(hash.hex());
    expect(() => hash.update(new Uint8Array(1))).toThrowError();
  });
});
