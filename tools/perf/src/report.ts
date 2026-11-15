/**
 * Runs after the suite. Prints a summary, and in local mode rewrites the
 * "Latest suite run" section of docs/perf.md between its two markers.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import {
  BUDGETS,
  BUNDLE_BUDGET_KB,
  RESULTS_FILE,
  currentMode,
  type SizeResult,
} from './budgets.ts';

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
    row('**CPM, one update, in the worker**', (r) => `**${seconds(r.cpmMs)}**`),
    row(
      'Budget',
      (r) =>
        `${seconds(BUDGETS[r.activities]!.cpmMs)}, ${verdict(r.cpmMs < BUDGETS[r.activities]!.cpmMs)}`,
    ),
    row('**Diff of two updates, in the worker**', (r) => `**${seconds(r.diffMs)}**`),
    row(
      'Budget',
      (r) =>
        `${seconds(BUDGETS[r.activities]!.diffMs)}, ${verdict(r.diffMs < BUDGETS[r.activities]!.diffMs)}`,
    ),
    row('Hand both schedules to the engine', (r) => seconds(r.engineLoadMs)),
    row('First rows of "changed, worst slip first"', (r) => seconds(r.firstRowsMs)),
    row('Next rows of the same view', (r) => seconds(r.scrollRowsMs)),
    row('Text search over all codes and names', (r) => seconds(r.searchMs)),
    row('Sort all activities by code', (r) => seconds(r.sortByCodeMs)),
    row('Main thread long tasks while the engine works', (r) => String(r.engineLongTasks)),
    row('Generate the pair in the browser', (r) => seconds(r.generateMs)),
    row("**Drop both files to the summary's answer**", (r) =>
      r.dropToSummaryMs === undefined ? 'not run' : `**${seconds(r.dropToSummaryMs)}**`,
    ),
    row('Budget: first rows visible after file drop', (r) =>
      r.dropToSummaryMs === undefined
        ? ''
        : `${seconds(BUDGETS[r.activities]!.firstRowsMs)}, ${verdict(r.dropToSummaryMs < BUDGETS[r.activities]!.firstRowsMs)}`,
    ),
    row('Summary to the first rows of the grid', (r) =>
      r.summaryToRowsMs === undefined ? 'not run' : seconds(r.summaryToRowsMs),
    ),
    row('**Grid and Gantt sweep, p95 frame time**', (r) =>
      r.scrollP95Ms === undefined ? 'not run' : `**${r.scrollP95Ms.toFixed(1)}ms**`,
    ),
    row('Budget', (r) =>
      r.scrollP95Ms === undefined
        ? ''
        : `${BUDGETS[r.activities]!.frameMs}ms, ${verdict(r.scrollP95Ms < BUDGETS[r.activities]!.frameMs)}`,
    ),
    row('Frames in the 3s sweep', (r) =>
      r.scrollFrames === undefined ? '' : String(r.scrollFrames),
    ),
    row('Main thread long tasks while scrolling', (r) =>
      r.scrollLongTasks === undefined ? '' : String(r.scrollLongTasks),
    ),
  ].join('\n');
}

export default function report(): void {
  if (!existsSync(RESULTS_FILE)) return;
  const all = (JSON.parse(readFileSync(RESULTS_FILE, 'utf8')) as SizeResult[]).sort(
    (a, b) => a.activities - b.activities,
  );
  const shell = all.find((r) => r.activities === 0)?.initialJsKb;
  const results = all.filter((r) => r.activities > 0);
  if (results.length === 0) return;
  const mode = currentMode();
  const bundle =
    shell === undefined
      ? ''
      : `\n\nInitial JavaScript for the app shell, gzipped: **${Math.round(shell)}KB**, budget ${BUNDLE_BUDGET_KB}KB, ${shell < BUNDLE_BUDGET_KB ? 'within' : '**over**'}.`;
  const body = table(results) + bundle;
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
    'CPM, diff and the row requests are single runs. The screens are driven as a planner would: both files dropped on the import screen, the summary, then the changes grid swept from the first row to the last over 3 seconds with the Gantt beside it. Frame rate is not capped to the display (`--disable-frame-rate-limit`), so a frame time is the work Slip does. Not measured yet: Firefox and Safari.',
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
