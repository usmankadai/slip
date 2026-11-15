/** Frame times for the performance HUD. Pure. */

/** The value below which `share` of the values fall, by nearest rank. NaN for no values. */
export function percentile(values: readonly number[], share: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(share * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))]!;
}

/**
 * Keeps the time between frames over a sliding window. `add` takes the frame's timestamp;
 * the first frame after a gap longer than `gapMs` (a hidden tab) is not counted as a slow frame.
 */
export class FrameWindow {
  private times: number[] = [];
  private deltas: number[] = [];
  private last: number | null = null;

  private readonly windowMs: number;
  private readonly gapMs: number;

  constructor(windowMs = 2000, gapMs = 1000) {
    this.windowMs = windowMs;
    this.gapMs = gapMs;
  }

  add(now: number): void {
    if (this.last !== null && now - this.last < this.gapMs) {
      this.times.push(now);
      this.deltas.push(now - this.last);
    }
    this.last = now;
    while (this.times.length > 0 && now - this.times[0]! > this.windowMs) {
      this.times.shift();
      this.deltas.shift();
    }
  }

  /** p50 and p95 of the frame times in the window, in milliseconds, or null with too few frames. */
  summary(): { p50: number; p95: number; frames: number } | null {
    if (this.deltas.length < 2) return null;
    return {
      p50: percentile(this.deltas, 0.5),
      p95: percentile(this.deltas, 0.95),
      frames: this.deltas.length,
    };
  }
}

/** "8.3ms", or "No frames yet". */
export function frameText(ms: number | null | undefined): string {
  return ms === null || ms === undefined || !Number.isFinite(ms)
    ? 'No frames yet'
    : `${ms.toFixed(1)}ms`;
}

/** "112MB" from bytes, or "Not available in this browser". */
export function megabytesText(bytes: number | null): string {
  return bytes === null
    ? 'Not available in this browser'
    : `${Math.round(bytes / 1e6).toLocaleString('en-GB')}MB`;
}
