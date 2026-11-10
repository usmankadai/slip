/**
 * Incremental SHA-256. The Web Crypto API can only hash a whole buffer at
 * once, and an import must hash a file of hundreds of megabytes as it
 * streams past, so this is the standard algorithm (FIPS 180-4) written out.
 */
const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export class Sha256 {
  private readonly state = new Int32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private readonly words = new Int32Array(64);
  private readonly pending = new Uint8Array(64);
  private pendingLength = 0;
  private totalBytes = 0;
  private finished = false;

  update(bytes: Uint8Array): this {
    if (this.finished) throw new Error('This hash has already been finished.');
    this.totalBytes += bytes.length;
    let at = 0;
    if (this.pendingLength > 0) {
      const take = Math.min(64 - this.pendingLength, bytes.length);
      this.pending.set(bytes.subarray(0, take), this.pendingLength);
      this.pendingLength += take;
      at = take;
      if (this.pendingLength < 64) return this;
      this.block(this.pending, 0);
      this.pendingLength = 0;
    }
    for (; at + 64 <= bytes.length; at += 64) this.block(bytes, at);
    if (at < bytes.length) {
      this.pending.set(bytes.subarray(at));
      this.pendingLength = bytes.length - at;
    }
    return this;
  }

  /** Finishes the hash and returns it as 64 lowercase hex characters. */
  hex(): string {
    if (!this.finished) {
      this.finished = true;
      const bitsHigh = Math.floor(this.totalBytes / 0x20000000);
      const bitsLow = (this.totalBytes << 3) >>> 0;
      const tail = new Uint8Array(this.pendingLength < 56 ? 64 : 128);
      tail.set(this.pending.subarray(0, this.pendingLength));
      tail[this.pendingLength] = 0x80;
      const view = new DataView(tail.buffer);
      view.setUint32(tail.length - 8, bitsHigh);
      view.setUint32(tail.length - 4, bitsLow);
      for (let at = 0; at < tail.length; at += 64) this.block(tail, at);
    }
    let text = '';
    for (const word of this.state) text += (word >>> 0).toString(16).padStart(8, '0');
    return text;
  }

  private block(bytes: Uint8Array, at: number): void {
    const w = this.words;
    for (let i = 0; i < 16; i++, at += 4) {
      w[i] = (bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!;
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15]!;
      const y = w[i - 2]!;
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
    }
    const state = this.state;
    let a = state[0]!;
    let b = state[1]!;
    let c = state[2]!;
    let d = state[3]!;
    let e = state[4]!;
    let f = state[5]!;
    let g = state[6]!;
    let h = state[7]!;
    for (let i = 0; i < 64; i++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (h + s1 + ((e & f) ^ (~e & g)) + K[i]! + w[i]!) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    state[0] = (state[0]! + a) | 0;
    state[1] = (state[1]! + b) | 0;
    state[2] = (state[2]! + c) | 0;
    state[3] = (state[3]! + d) | 0;
    state[4] = (state[4]! + e) | 0;
    state[5] = (state[5]! + f) | 0;
    state[6] = (state[6]! + g) | 0;
    state[7] = (state[7]! + h) | 0;
  }
}
