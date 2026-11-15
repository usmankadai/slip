import { defineConfig } from '@playwright/test';

const PORT = 6007;

/**
 * A screenshot of every Storybook story, in both densities (design-system spec). Baselines are
 * made and compared only inside the official Playwright Docker image, in CI and through
 * `pnpm visual` locally, so fonts and anti-aliasing are the same everywhere. Any pixel that
 * differs beyond the default colour threshold fails.
 */
export default defineConfig({
  testDir: 'src',
  testMatch: '*.visual.ts',
  snapshotPathTemplate: '{testDir}/../baselines/{projectName}/{arg}{ext}',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixels: 0 },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  },
  projects: [
    // The project name is the density each story is drawn in.
    { name: 'compact' },
    { name: 'comfortable' },
  ],
  webServer: {
    command: `node src/serve.ts ../../packages/ui/storybook-static ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.json`,
    reuseExistingServer: false,
  },
});
