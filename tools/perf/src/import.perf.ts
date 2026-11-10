/**
 * Import performance: a cold import of one file, and reopening it from the
 * browser cache, at each size the mode asks for. Medians over several runs.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import type { PerfImport } from '../../../apps/web/src/dev/perfTypes.ts';
import { BUDGETS, RESULTS_FILE, currentMode, median, type SizeResult } from './budgets.ts';

const mode = currentMode();

function record(result: SizeResult): void {
  mkdirSync(dirname(RESULTS_FILE), { recursive: true });
  const all: SizeResult[] = existsSync(RESULTS_FILE)
    ? JSON.parse(readFileSync(RESULTS_FILE, 'utf8'))
    : [];
  writeFileSync(
    RESULTS_FILE,
    JSON.stringify([...all.filter((r) => r.activities !== result.activities), result], null, 2),
  );
}

test.beforeAll(() => {
  if (existsSync(RESULTS_FILE)) writeFileSync(RESULTS_FILE, '[]');
});

for (const activities of mode.sizes) {
  test(`import ${activities.toLocaleString('en-GB')} activities`, async ({ page }) => {
    const budget = BUDGETS[activities]!;
    await page.goto('/?perf');
    await page.waitForFunction(() => window.slipPerf !== undefined);
    const generateMs = await page.evaluate((n) => window.slipPerf!.prepare(n), activities);

    const cold: PerfImport[] = [];
    const warm: PerfImport[] = [];
    for (let run = 0; run < mode.runs; run++) {
      await page.evaluate(() => window.slipPerf!.clearCache());
      cold.push(await page.evaluate(() => window.slipPerf!.importPrepared(0)));
      warm.push(await page.evaluate(() => window.slipPerf!.importPrepared(0)));
    }
    // Load the second update too, then measure memory with both held.
    await page.evaluate(() => window.slipPerf!.importPrepared(1));
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');
    await client.send('HeapProfiler.collectGarbage');
    const { metrics } = await client.send('Performance.getMetrics');
    const heapBytes = metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? 0;
    const bufferBytes = cold[0]!.bufferBytes * 2;

    for (const result of cold) {
      expect(result.fromCache, 'a cold import must not come from the cache').toBe(false);
      expect(result.cached, 'the cache write must succeed').toBe(true);
      expect(result.warnings, 'the synthetic file must parse cleanly').toBe(0);
      expect(result.activities).toBe(activities);
    }
    for (const result of warm)
      expect(result.fromCache, 'a reopen must come from the cache').toBe(true);

    // Hand both schedules to the engine worker and time its main operations.
    const engine = await page.evaluate(() => window.slipPerf!.engine());
    expect(engine.activities, 'the engine must see every activity').toBeGreaterThanOrEqual(
      activities,
    );
    expect(engine.differsFromFile, 'recalculated dates must match a synthetic file').toBe(0);

    const everyTask = [...cold, ...warm].flatMap((result) => result.longTasks);
    const result: SizeResult = {
      activities,
      runs: mode.runs,
      fileMb: cold[0]!.fileBytes / 1e6,
      generateMs,
      fullImportMs: median(cold.map((r) => r.wallMs)),
      hashMs: median(cold.map((r) => r.hashMs)),
      parseMs: median(cold.map((r) => r.parseMs)),
      cacheWriteMs: median(cold.map((r) => r.cacheMs)),
      reopenMs: median(warm.map((r) => r.wallMs)),
      longTasks: Math.max(...[...cold, ...warm].map((r) => r.longTasks.length)),
      longestTaskMs: Math.max(0, ...everyTask),
      heapMb: heapBytes / 1e6,
      bufferMb: bufferBytes / 1e6,
      memoryMb: (heapBytes + bufferBytes) / 1e6,
      engineLoadMs: engine.loadMs,
      cpmMs: engine.cpmMs,
      diffMs: engine.diffMs,
      firstRowsMs: engine.firstRowsMs,
      scrollRowsMs: engine.scrollRowsMs,
      searchMs: engine.searchMs,
      sortByCodeMs: engine.sortByCodeMs,
      engineLongTasks: engine.longTasks.length,
    };
    record(result);
    await page.evaluate(() => window.slipPerf!.reset());

    // Collect every failure so one run reports all of them.
    expect
      .soft(result.fullImportMs, 'full import')
      .toBeLessThan(budget.fullImportMs * mode.timeFactor);
    expect
      .soft(result.reopenMs, 'reopen from cache')
      .toBeLessThan(budget.reopenMs * mode.timeFactor);
    expect.soft(result.longTasks, 'main thread long tasks').toBeLessThanOrEqual(budget.longTasks);
    expect.soft(result.memoryMb, 'memory with both updates loaded').toBeLessThan(budget.memoryMb);
    expect.soft(result.cpmMs, 'CPM in the worker').toBeLessThan(budget.cpmMs * mode.timeFactor);
    expect.soft(result.diffMs, 'diff in the worker').toBeLessThan(budget.diffMs * mode.timeFactor);
    expect
      .soft(result.engineLongTasks, 'main thread long tasks while the engine works')
      .toBeLessThanOrEqual(budget.longTasks);
  });
}
