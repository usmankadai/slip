import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

/** Packages that run in workers, Node and tests. They must stay free of the DOM and React. */
const PURE_PACKAGES = ['packages/xer/**/*.ts', 'packages/engine/**/*.ts', 'packages/gen/**/*.ts'];

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'fixtures/**'] },
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
    files: ['*.config.{js,ts}', '**/*.config.{js,ts}', 'scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
