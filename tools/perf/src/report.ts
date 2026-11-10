/**
 * Runs after the suite. Prints a summary, and in local mode rewrites the
 * "Latest suite run" section of docs/perf.md between its two markers.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { BUDGETS, RESULTS_FILE, currentMode, type SizeResult } from './budgets.ts';

const START = '<!-- perf:start -->';
const END = '<!-- perf:end -->';
const DOC = '../../docs/perf.md';

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
const megabytes = (mb: number) => `${Math.round(mb)}MB`;
const label = (activities: number) =>
  activities >= 1_000_000 ? `${activities / 1_000_000}M` : `${activities / 1000}K`;

function table(results: SizeResult[]): string {
  const row = (name: string, cell: (r: SizeResult) => string) =>
    `| ${name} | ${results.map(cell).join(' | ')} |`;
  const verdict = (ok: boolean) => (ok ? 'within' : '**over**');
  return [
    `| Per file, median of ${results[0]!.runs} | ${results.map((r) => label(r.activities)).join(' | ')} |`,
    `|---|${results.map(() => '---').join('|')}|`,
    row('File size', (r) => megabytes(r.fileMb)),
    row('Hash', (r) => seconds(r.hashMs)),
    row('Parse', (r) => seconds(r.parseMs)),
    row('Pack and write to cache', (r) => seconds(r.cacheWriteMs)),
    row('**Full import**', (r) => `**${seconds(r.fullImportMs)}**`),
    row(
      'Budget',
      (r) =>
        `${seconds(BUDGETS[r.activities]!.fullImportMs)}, ${verdict(r.fullImportMs < BUDGETS[r.activities]!.fullImportMs)}`,
    ),
    row('**Reopen from cache**', (r) => `**${seconds(r.reopenMs)}**`),
    row(
      'Budget',
      (r) =>
        `${seconds(BUDGETS[r.activities]!.reopenMs)}, ${verdict(r.reopenMs < BUDGETS[r.activities]!.reopenMs)}`,
    ),
    row('Main thread long tasks, worst import', (r) =>
      r.longTasks === 0 ? '0' : `${r.longTasks} (longest ${Math.round(r.longestTaskMs)}ms)`,
    ),
    row('JS heap, both updates loaded', (r) => megabytes(r.heapMb)),
    row('Typed arrays, both updates loaded', (r) => megabytes(r.bufferMb)),
    row('**Memory total**', (r) => `**${megabytes(r.memoryMb)}**`),
    row(
      'Budget (starting estimate)',
      (r) =>
        `${megabytes(BUDGETS[r.activities]!.memoryMb)}, ${verdict(r.memoryMb < BUDGETS[r.activities]!.memoryMb)}`,
    ),
    row('Generate the pair in the browser', (r) => seconds(r.generateMs)),
  ].join('\n');
}

export default function report(): void {
  if (!existsSync(RESULTS_FILE)) return;
  const results = (JSON.parse(readFileSync(RESULTS_FILE, 'utf8')) as SizeResult[]).sort(
    (a, b) => a.activities - b.activities,
  );
  if (results.length === 0) return;
  const mode = currentMode();
  const body = table(results);
  console.log(`\nPerf results (${mode.name} mode)\n${body}\n`);
  if (mode.name !== 'local' || !existsSync(DOC)) return;

  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    // Not a git checkout; leave it unknown.
  }
  const section = [
    START,
    '## Latest suite run',
    '',
    `Written by \`pnpm perf\`. Release build served by \`vite preview\`, headless Chromium, synthetic rail fixtures at seed 42, median of ${results[0]!.runs} runs.`,
    '',
    `- Machine: ${cpus()[0]?.model ?? 'unknown CPU'}, ${cpus().length} cores, ${Math.round(totalmem() / 2 ** 30)}GB, ${platform()} ${release()} ${arch()}`,
    `- Commit: ${commit}`,
    '',
    body,
    '',
    'Not measured yet: first rows visible, CPM, diff, scroll frame times, Firefox and Safari.',
    END,
  ].join('\n');
  const doc = readFileSync(DOC, 'utf8');
  const next =
    doc.includes(START) && doc.includes(END)
      ? doc.slice(0, doc.indexOf(START)) + section + doc.slice(doc.indexOf(END) + END.length)
      : `${doc.trimEnd()}\n\n${section}\n`;
  writeFileSync(DOC, next);
  console.log('Updated docs/perf.md');
}
