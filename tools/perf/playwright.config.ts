import { defineConfig } from '@playwright/test';

const PORT = 4173;

/**
 * The perf suite measures a production build served by `vite preview`,
 * never the dev server. One worker and no parallelism: timings from two
 * tests running at once would be meaningless.
 */
export default defineConfig({
  testDir: 'src',
  testMatch: '*.perf.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 15 * 60 * 1000,
  reporter: [['list']],
  globalTeardown: './src/report.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    headless: true,
    launchOptions: {
      // Lets the suite force a garbage collection before reading memory.
      args: ['--js-flags=--expose-gc'],
    },
  },
  webServer: {
    command: `pnpm --filter @slip/web build && pnpm --filter @slip/web preview --port ${PORT} --strictPort`,
    cwd: '../..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
