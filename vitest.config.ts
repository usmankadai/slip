import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/test/**/*.test.{ts,tsx}',
      'tools/*/test/**/*.test.ts',
      'apps/*/src/**/*.test.{ts,tsx}',
    ],
    environment: 'node',
  },
});
