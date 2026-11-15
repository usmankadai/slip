import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import slip from './tools/eslint-plugin-slip/src/index.ts';

/** Packages that run in workers, Node and tests. They must stay free of the DOM and React. */
const PURE_PACKAGES = ['packages/xer/**/*.ts', 'packages/engine/**/*.ts', 'packages/gen/**/*.ts'];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/storybook-static/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/test-results/**',
      'fixtures/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.worker } },
    rules: {
      // Typed array access is checked by tests, not by non-null assertions on every read.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: PURE_PACKAGES,
    languageOptions: { globals: { ...globals.worker } },
    rules: {
      // XER dates have no timezone (decision D13). Date would silently apply one.
      'no-restricted-globals': [
        'error',
        {
          name: 'Date',
          message: 'Schedule dates are wall-clock integers. Use the helpers in @slip/xer dates.ts.',
        },
        { name: 'window', message: 'Pure packages must not touch the DOM.' },
        { name: 'document', message: 'Pure packages must not touch the DOM.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*'],
              message: 'Pure packages must not import React.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '*.config.{js,ts}',
      '**/*.config.{js,ts}',
      'scripts/**/*.ts',
      'tools/**/*.ts',
      'apps/api/**/*.ts',
      'packages/ui/test/**/*.ts',
      'packages/ui/.storybook/**/*.{ts,tsx}',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    // Design values come from tokens.css (design-system spec). Tests may hold colour strings as data.
    files: ['apps/web/src/**/*.{ts,tsx}', 'packages/ui/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    plugins: { slip },
    rules: {
      'slip/no-raw-color': 'error',
      'slip/no-raw-spacing': 'error',
    },
  },
  prettier,
);
