/**
 * "The initial JavaScript for the app shell is at most 250 KB compressed": what the built page
 * asks for before anything else, the entry script and the modules it preloads, gzipped. Stable
 * from run to run, so it is checked in CI at the budget itself.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { BUNDLE_BUDGET_KB, record } from './budgets.ts';

const DIST = resolve(import.meta.dirname, '../../../apps/web/dist');

test('initial JavaScript for the app shell', () => {
  const html = readFileSync(resolve(DIST, 'index.html'), 'utf8');
  const scripts = [
    ...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g),
    ...html.matchAll(/<link rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
  ].map((match) => match[1]!);
  expect(scripts.length, 'the page must load at least one script').toBeGreaterThan(0);
  const bytes = scripts.reduce(
    (total, path) => total + gzipSync(readFileSync(resolve(DIST, `.${path}`))).length,
    0,
  );
  const kb = bytes / 1024;
  record({ activities: 0, initialJsKb: kb });
  expect(kb, 'initial JavaScript, gzipped').toBeLessThan(BUNDLE_BUDGET_KB);
});
