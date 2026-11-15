/**
 * Checks on the repository itself, for what ESLint cannot see: the CSS, and
 * whether every screen has a story for each of its states.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isRawColour } from '../src/index.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const SOURCES = ['apps/web/src', 'packages/ui/src'].map((dir) => join(ROOT, dir));

function files(dir: string, ending: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...files(path, ending));
    else if (name.endsWith(ending)) out.push(path);
  }
  return out;
}

const css = SOURCES.flatMap((dir) => files(dir, '.css')).filter(
  (path) => !path.endsWith('/tokens.css'),
);

/** Each declaration in a CSS file, with its line, ignoring comments. */
function declarations(path: string): { line: number; property: string; value: string }[] {
  const text = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );
  const out: { line: number; property: string; value: string }[] = [];
  text.split('\n').forEach((line, index) => {
    const match = /^\s*([a-z-]+)\s*:\s*(.+?);?\s*$/.exec(line);
    if (match) out.push({ line: index + 1, property: match[1]!, value: match[2]! });
  });
  return out;
}

const SPACING =
  /^(?:margin|padding)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$|^(?:gap|row-gap|column-gap)$/;

describe('styles outside tokens.css', () => {
  it('has CSS files to check', () => {
    expect(css.length).toBeGreaterThan(10);
  });

  it('uses no colour literals', () => {
    const found = css.flatMap((path) =>
      declarations(path)
        .filter(
          ({ value }) =>
            value.split(/\s+/).some((word) => isRawColour(word.replace(/[,;)]+$/, ''))) ||
            /\b(?:rgba?|hsla?)\(/.test(value),
        )
        .map(
          ({ line, property, value }) => `${relative(ROOT, path)}:${line} ${property}: ${value}`,
        ),
    );
    expect(found).toEqual([]);
  });

  it('uses no pixel values for margin, padding or gap', () => {
    const found = css.flatMap((path) =>
      declarations(path)
        .filter(({ property, value }) => SPACING.test(property) && /\d(?:\.\d+)?px\b/.test(value))
        .map(
          ({ line, property, value }) => `${relative(ROOT, path)}:${line} ${property}: ${value}`,
        ),
    );
    expect(found).toEqual([]);
  });
});

describe('screens', () => {
  const views = files(join(ROOT, 'apps/web/src/features'), '.tsx').filter((path) =>
    /(View|Grid|Panel)\.tsx$/.test(path),
  );

  it('each have a story for loading, empty and error, and at least one more', () => {
    const missing: string[] = [];
    for (const view of views) {
      const stories = view.replace(/\.tsx$/, '.stories.tsx');
      let text: string;
      try {
        text = readFileSync(stories, 'utf8');
      } catch {
        missing.push(`${relative(ROOT, view)}: no stories file`);
        continue;
      }
      const names = [...text.matchAll(/export const (\w+)\s*[:=]/g)].map((match) => match[1]!);
      for (const state of ['Loading', 'Empty', 'Error']) {
        if (!names.some((name) => name.startsWith(state)))
          missing.push(`${relative(ROOT, view)}: no ${state} story`);
      }
      if (names.filter((name) => !/^(Loading|Empty|Error)/.test(name)).length === 0) {
        missing.push(`${relative(ROOT, view)}: no populated story`);
      }
    }
    expect(views.length).toBeGreaterThan(5);
    expect(missing).toEqual([]);
  });
});
