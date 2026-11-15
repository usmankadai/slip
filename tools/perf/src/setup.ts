/** Runs before the suite: starts each run with an empty results file, whichever test runs first. */
import { existsSync, writeFileSync } from 'node:fs';
import { RESULTS_FILE } from './budgets.ts';

export default function setup(): void {
  if (existsSync(RESULTS_FILE)) writeFileSync(RESULTS_FILE, '[]');
}
