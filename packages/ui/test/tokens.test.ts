import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROW_HEIGHT } from '../src/density.ts';

/**
 * The rules in D16 ("Rules that come from the checks"), enforced on tokens.css itself,
 * so a changed value cannot quietly break contrast.
 */

const css = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');

const tokens = new Map<string, string>();
for (const match of css.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
  if (!tokens.has(match[1]!)) tokens.set(match[1]!, match[2]!);
}

function hex(name: string): string {
  const value = tokens.get(name);
  if (value === undefined)
    throw new Error(`Token ${name} is missing or is not a six digit hex colour`);
  return value;
}

function luminance(colour: string): number {
  const channel = (offset: number): number => {
    const value = parseInt(colour.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

const SURFACES = ['--surface-0', '--surface-1', '--surface-2', '--surface-3'];
const SIDES = ['late', 'early'];

describe('tokens.css', () => {
  it('defines every colour token the design system spec names', () => {
    const names = [
      ...SURFACES,
      '--text-primary',
      '--text-secondary',
      '--text-muted',
      '--text-inverse',
      '--border-subtle',
      '--border-strong',
      '--accent',
      '--focus-ring',
      '--slip-none',
      '--critical',
      ...SIDES.flatMap((side) => [1, 2, 3, 4, 5].map((step) => `--slip-${side}-${step}`)),
    ];
    for (const name of names) expect(() => hex(name), name).not.toThrow();
  });

  it('keeps primary text at 7:1 or better on every surface', () => {
    for (const surface of SURFACES) {
      expect(contrast('--text-primary', surface), surface).toBeGreaterThanOrEqual(7);
    }
  });

  it('keeps secondary text at 4.5:1 or better on every surface', () => {
    for (const surface of SURFACES) {
      expect(contrast('--text-secondary', surface), surface).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps muted text at 4.5:1 or better on the surfaces it is allowed on', () => {
    for (const surface of SURFACES.slice(0, 3)) {
      expect(contrast('--text-muted', surface), surface).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the strong border, the accent and the focus ring at 3:1 or better on base, panel and header', () => {
    for (const name of ['--border-strong', '--accent', '--focus-ring']) {
      for (const surface of SURFACES.slice(0, 3)) {
        expect(contrast(name, surface), `${name} on ${surface}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('keeps scale steps 4 and 5, used for bars and glyphs, at 3:1 or better on base and panel', () => {
    for (const side of SIDES) {
      for (const step of [4, 5]) {
        for (const surface of SURFACES.slice(0, 2)) {
          const name = `--slip-${side}-${step}`;
          expect(contrast(name, surface), `${name} on ${surface}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('keeps dark text readable on steps 1 to 4 and inverse text on step 5', () => {
    for (const side of SIDES) {
      for (const step of [1, 2, 3, 4]) {
        const name = `--slip-${side}-${step}`;
        expect(contrast('--text-primary', name), name).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast('--text-inverse', `--slip-${side}-5`), side).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps slip text colours and critical at 4.5:1 or better on base and panel', () => {
    for (const name of ['--slip-late-text', '--slip-early-text', '--critical']) {
      for (const surface of SURFACES.slice(0, 2)) {
        expect(contrast(name, surface), `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('makes each scale darker at every step', () => {
    for (const side of SIDES) {
      for (const step of [1, 2, 3, 4]) {
        expect(luminance(hex(`--slip-${side}-${step}`))).toBeGreaterThan(
          luminance(hex(`--slip-${side}-${step + 1}`)),
        );
      }
    }
  });
});

describe('density', () => {
  it('keeps the row heights used for windowing equal to the tokens', () => {
    const compact = /:root\s*\{[^}]*--row-height:\s*(\d+)px/.exec(css)?.[1];
    const comfortable = /\[data-density='comfortable'\]\s*\{[^}]*--row-height:\s*(\d+)px/.exec(
      css,
    )?.[1];
    expect(Number(compact)).toBe(ROW_HEIGHT.compact);
    expect(Number(comfortable)).toBe(ROW_HEIGHT.comfortable);
  });
});
