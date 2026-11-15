/**
 * The real screens, driven as a planner would: drop two files, wait for the update summary, open
 * the changes grid, then sweep it from the first row to the last while timing every frame.
 * Fixtures come from fixtures/synthetic when present, and are generated otherwise (CI has none).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { generatePair, xerText } from '../../../packages/gen/src/index.ts';
import { BUDGETS, currentMode, median, record, type SizeResult } from './budgets.ts';

const mode = currentMode();
const FIXTURES = resolve(import.meta.dirname, '../../../fixtures/synthetic');
const GENERATED = resolve(import.meta.dirname, '../test-results/generated');

/** The two files of the rail pair at seed 42, from the fixtures folder or written here. */
function filesFor(activities: number): [string, string] {
  const name =
    activities >= 1_000_000 ? `rail-${activities / 1_000_000}m` : `rail-${activities / 1000}k`;
  const dir = resolve(FIXTURES, name);
  const paths: [string, string] = [resolve(dir, 'update-01.xer'), resolve(dir, 'update-02.xer')];
  if (paths.every((path) => existsSync(path))) return paths;
  const out = resolve(GENERATED, name);
  const made: [string, string] = [resolve(out, 'update-01.xer'), resolve(out, 'update-02.xer')];
  if (made.every((path) => existsSync(path))) return made;
  mkdirSync(out, { recursive: true });
  const pair = generatePair({ activities, seed: 42, sector: 'rail' });
  writeFileSync(made[0], xerText(pair.update01), 'latin1');
  writeFileSync(made[1], xerText(pair.update02), 'latin1');
  return made;
}

/** Sweeps the grid from top to bottom over `ms`, timing each frame; returns frame times and long tasks. */
async function sweep(page: import('@playwright/test').Page, ms: number) {
  return page.evaluate(async (duration) => {
    const grid = document.querySelector<HTMLElement>('[role=grid]');
    if (!grid) throw new Error('No grid on screen.');
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    });
    observer.observe({ type: 'longtask' });
    const frames: number[] = [];
    await new Promise<void>((done) => {
      const start = performance.now();
      let last = start;
      requestAnimationFrame(function step(now) {
        frames.push(now - last);
        last = now;
        const share = Math.min(1, (now - start) / duration);
        grid.scrollTop = share * (grid.scrollHeight - grid.clientHeight);
        if (share < 1) requestAnimationFrame(step);
        else done();
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    observer.disconnect();
    // The first frame waits for the sweep to start; it is not a scroll frame.
    return { frames: frames.slice(1), longTasks };
  }, ms);
}

const p95 = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)] ?? Number.NaN;
};

/**
 * Timed inside the page, so the time Playwright takes to hand a file to the browser is not
 * counted: from the change event of the second file input to the first frame in which the
 * summary shows its answer.
 */
const TIMER = `(() => {
  const marks = (window.__slipPerf = { drop: 0, answer: 0 });
  document.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === 'file') marks.drop = performance.now();
  }, true);
  new MutationObserver(() => {
    if (!marks.drop || marks.answer) return;
    for (const h2 of document.querySelectorAll('h2')) {
      const text = h2.textContent || '';
      if (/moved|did not move|Nothing changed|no milestones/i.test(text) && !/Finding/.test(text)) {
        requestAnimationFrame(() => { marks.answer = performance.now(); });
        return;
      }
    }
  }).observe(document, { subtree: true, childList: true, characterData: true });
})()`;

for (const activities of mode.sizes) {
  test(`screens with ${activities.toLocaleString('en-GB')} activities`, async ({ page }) => {
    const budget = BUDGETS[activities]!;
    const [fileA, fileB] = filesFor(activities);
    const toSummary: number[] = [];
    const toRows: number[] = [];
    const scrollP95: number[] = [];
    let scrollFrames = 0;
    let scrollLongTasks = 0;

    await page.addInitScript(TIMER);
    for (let run = 0; run < mode.runs; run++) {
      // A fresh page with an empty cache each run, so every run is a cold import.
      await page.goto('/');
      await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        for await (const name of (root as unknown as { keys(): AsyncIterable<string> }).keys()) {
          await root.removeEntry(name, { recursive: true });
        }
        indexedDB.deleteDatabase('slip');
      });
      await page.goto('about:blank');
      await page.goto('/');
      const inputs = page.locator('input[type=file]');
      await inputs.nth(0).setInputFiles(fileA);
      await inputs.nth(1).setInputFiles(fileB);
      await page.getByRole('button', { name: 'Compare updates' }).click({ timeout: 120_000 });
      // The summary leads with the milestones: their answer is its first content.
      await page
        .locator('h2', {
          hasText: /moved|did not move|Nothing changed|no milestones/i,
          hasNotText: 'Finding',
        })
        .first()
        .waitFor({ timeout: 120_000 });
      await page.waitForFunction(
        () => (window as unknown as { __slipPerf: { answer: number } }).__slipPerf.answer > 0,
      );
      toSummary.push(
        await page.evaluate(() => {
          const marks = (window as unknown as { __slipPerf: { drop: number; answer: number } })
            .__slipPerf;
          return marks.answer - marks.drop;
        }),
      );

      const opened = Date.now();
      await page.getByRole('button', { name: 'See all changes' }).click();
      await page
        .locator('[role=row][aria-rowindex="2"] [role=gridcell]')
        .nth(1)
        .filter({ hasText: /\S/ })
        .waitFor();
      toRows.push(Date.now() - opened);

      await page.waitForTimeout(300);
      const { frames, longTasks } = await sweep(page, 3000);
      scrollP95.push(p95(frames));
      scrollFrames = Math.max(scrollFrames, frames.length);
      scrollLongTasks = Math.max(scrollLongTasks, longTasks.length);
    }

    const result: Partial<SizeResult> & { activities: number } = {
      activities,
      dropToSummaryMs: median(toSummary),
      summaryToRowsMs: median(toRows),
      scrollP95Ms: median(scrollP95),
      scrollFrames,
      scrollLongTasks,
    };
    record(result);

    expect
      .soft(result.dropToSummaryMs!, 'drop to the summary')
      .toBeLessThan(budget.firstRowsMs * mode.timeFactor);
    expect.soft(result.scrollP95Ms!, 'scroll, 95th percentile frame').toBeLessThan(budget.frameMs);
    expect
      .soft(result.scrollLongTasks!, 'long tasks while scrolling')
      .toBeLessThanOrEqual(budget.longTasks);
  });
}
