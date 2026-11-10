/**
 * Growable typed-array builders, and the shared string table.
 *
 * The parser does not know the row count up front, so columns grow by
 * doubling and are trimmed to their exact length once at the end.
 */

export class Int32Builder {
  private data: Int32Array;
  length = 0;

  constructor(capacity = 1024) {
    this.data = new Int32Array(capacity);
  }

  push(value: number): void {
    if (this.length === this.data.length) {
      const grown = new Int32Array(this.data.length * 2);
      grown.set(this.data);
      this.data = grown;
    }
    this.data[this.length++] = value;
  }

  at(index: number): number {
    return this.data[index]!;
  }

  /** An exact-length copy with its own buffer, safe to transfer. */
  finish(): Int32Array {
    return this.data.slice(0, this.length);
  }
}

export class Uint8Builder {
  private data: Uint8Array;
  length = 0;

  constructor(capacity = 1024) {
    this.data = new Uint8Array(capacity);
  }

  push(value: number): void {
    if (this.length === this.data.length) {
      const grown = new Uint8Array(this.data.length * 2);
      grown.set(this.data);
      this.data = grown;
    }
    this.data[this.length++] = value;
  }

  at(index: number): number {
    return this.data[index]!;
  }

  finish(): Uint8Array {
    return this.data.slice(0, this.length);
  }
}

/**
 * Every string in a schedule, as UTF-8 bytes in one buffer.
 * String `id` occupies bytes `offsets[id]` up to `offsets[id + 1]`.
 */
export interface StringTable {
  bytes: Uint8Array;
  /** Length is the string count plus one. */
  offsets: Int32Array;
}

/** A column of string ids into the schedule's StringTable. */
export type StringColumn = Int32Array;

export class StringTableBuilder {
  private bytes = new Uint8Array(4096);
  private byteLength = 0;
  private readonly offsets = new Int32Builder();
  private readonly encoder = new TextEncoder();

  constructor() {
    this.offsets.push(0);
  }

  /** Appends a string and returns its id. */
  add(text: string): number {
    // A UTF-16 code unit becomes at most 3 UTF-8 bytes.
    const worstCase = text.length * 3;
    if (this.byteLength + worstCase > this.bytes.length) {
      let capacity = this.bytes.length * 2;
      while (capacity < this.byteLength + worstCase) capacity *= 2;
      const grown = new Uint8Array(capacity);
      grown.set(this.bytes.subarray(0, this.byteLength));
      this.bytes = grown;
    }
    const { written } = this.encoder.encodeInto(text, this.bytes.subarray(this.byteLength));
    this.byteLength += written;
    this.offsets.push(this.byteLength);
    return this.offsets.length - 2;
  }

  finish(): StringTable {
    return { bytes: this.bytes.slice(0, this.byteLength), offsets: this.offsets.finish() };
  }
}

const decoder = new TextDecoder('utf-8');

/** Decodes one string. Callers cache the result for visible rows; never call this for a whole column. */
export function stringAt(table: StringTable, id: number): string {
  if (id < 0 || id + 1 >= table.offsets.length) return '';
  return decoder.decode(table.bytes.subarray(table.offsets[id]!, table.offsets[id + 1]!));
}
