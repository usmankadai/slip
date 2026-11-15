import { describe, expect, it } from 'vitest';
import { FrameWindow, frameText, megabytesText, percentile } from './frames.ts';

describe('frame times for the HUD', () => {
  it('takes percentiles by nearest rank', () => {
    const values = Array.from({ length: 100 }, (_, k) => k + 1);
    expect(percentile(values, 0.5)).toBe(50);
    expect(percentile(values, 0.95)).toBe(95);
    expect(percentile([7], 0.95)).toBe(7);
    expect(percentile([], 0.5)).toBeNaN();
  });

  it('keeps only the last two seconds of frames', () => {
    const window = new FrameWindow(2000);
    for (let t = 0; t <= 4000; t += 10) window.add(t);
    // From 2,000ms to 4,000ms inclusive.
    expect(window.summary()).toEqual({ p50: 10, p95: 10, frames: 201 });
  });

  it('counts a slow frame, but not the pause of a hidden tab', () => {
    const window = new FrameWindow(2000, 1000);
    let t = 0;
    window.add(t);
    for (let k = 0; k < 9; k++) window.add((t += 16));
    window.add((t += 80)); // one slow frame among ten
    expect(window.summary()).toEqual({ p50: 16, p95: 80, frames: 10 });
    window.add((t += 5000)); // the tab was hidden: not a frame, and it empties the window
    window.add((t += 16));
    window.add(t + 16);
    expect(window.summary()).toEqual({ p50: 16, p95: 16, frames: 2 });
  });

  it('says so when there is nothing to show', () => {
    expect(new FrameWindow().summary()).toBeNull();
    expect(frameText(null)).toBe('No frames yet');
    expect(frameText(8.26)).toBe('8.3ms');
    expect(megabytesText(null)).toBe('Not available in this browser');
    expect(megabytesText(112_400_000)).toBe('112MB');
  });
});
