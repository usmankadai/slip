/**
 * Builds docs/evals.md from the rows of a complete run. Every number is
 * recomputed from the rows; nothing is carried over from the run's own
 * summary. Hand-written reading notes in docs/evals-notes.md are appended.
 */

export interface ResultRow {
  prompt_id: string;
  tags: string[];
  grade: Record<string, number>;
  usage: Record<string, number>;
  latency_s: number;
  words: number;
  model_calls: number;
  tool_result_bytes: number;
  model: string;
}

export interface ReportInput {
  variant: string;
  model: string;
  effort: string;
  reps: number;
  activities: number;
  seed: number;
  rows: ResultRow[];
  errors: number;
  /** Dollars at list prices, or null when the model's price is not known here. */
  cost: number | null;
  callsAllowed: number;
  notes: string;
}

const CHECKS = ['correct', 'cited', 'grounded', 'proposal', 'declined', 'safe'];

export function median(list: number[]): number {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
}

/** Wilson 95% interval for a pass rate, as whole percentages. */
export function interval(passed: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = passed / n;
  const centre = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
  return [Math.round((centre - half) * 100), Math.round((centre + half) * 100)];
}

export function buildReport(input: ReportInput): string {
  const { rows } = input;
  const n = rows.length;
  const passed = rows.filter((row) => row.grade.pass === 1).length;
  const [low, high] = interval(passed, n);
  const kinds = [...new Set(rows.map((row) => row.tags[0]!))];
  const words = rows.map((row) => row.words).sort((a, b) => a - b);
  const count = input.activities.toLocaleString('en-GB');
  const lines = [
    '# Agent eval results',
    '',
    'Written by `pnpm evals`. The cases are listed in [evals-cases.md](evals-cases.md); how they are graded is in [spec/agent-api.md](spec/agent-api.md).',
    '',
    `## ${input.variant}: ${passed} of ${n} passed`,
    '',
    `- **Model:** \`${input.model}\`, effort \`${input.effort}\`, ${input.reps} run of each case.`,
    `- **Schedule:** a generated ${count} activity rail pair, seed ${input.seed}. Four cases use a copy with instructions planted in three activity names.`,
    `- **Pass rate:** ${n ? Math.round((passed / n) * 100) : 0}%, with a 95% interval of ${low}% to ${high}% at this number of cases.`,
    `- **Harness errors:** ${input.errors}. These are kept apart and never scored as wrong answers.`,
    ...(input.cost === null
      ? []
      : [
          `- **Cost:** about $${input.cost.toFixed(2)} at list prices, $${(input.cost / Math.max(1, n)).toFixed(3)} per question.`,
        ]),
    '',
    '### By kind of question',
    '',
    '| Kind | Cases | Passed |',
    '|---|---|---|',
    ...kinds.map((kind) => {
      const of = rows.filter((row) => row.tags[0] === kind);
      return `| ${kind} | ${of.length} | ${of.filter((row) => row.grade.pass === 1).length} |`;
    }),
    '',
    '### By check',
    '',
    'Each answer is graded on the checks that apply to its case. A case passes when all of them do.',
    '',
    '| Check | Applies to | Passed |',
    '|---|---|---|',
    ...CHECKS.map((id) => {
      const of = rows.filter((row) => row.grade[id] !== undefined);
      return `| ${id} | ${of.length} | ${of.filter((row) => row.grade[id] === 1).length} |`;
    }),
    '',
    '### Per question',
    '',
    `- **Time:** median ${median(rows.map((row) => row.latency_s))}s, longest ${Math.max(0, ...rows.map((row) => row.latency_s))}s.`,
    `- **Model calls:** median ${median(rows.map((row) => row.model_calls))}, most ${Math.max(0, ...rows.map((row) => row.model_calls))} of ${input.callsAllowed} allowed.`,
    `- **Answer length:** median ${median(words)} words, from ${words[0] ?? 0} to ${words[words.length - 1] ?? 0}. ${words.filter((value) => value > 250).length} of ${n} are over 250 words and ${words.filter((value) => value > 150).length} are over 150. Length is recorded, not graded.`,
    `- **Schedule data sent to the model:** median ${median(rows.map((row) => row.tool_result_bytes))} bytes of tool results, most ${Math.max(0, ...rows.map((row) => row.tool_result_bytes))}, from a schedule of ${count} activities.`,
    '',
    '| Case | Kind | Result | Calls | Seconds | Words |',
    '|---|---|---|---|---|---|',
    ...rows.map(
      (row) =>
        `| ${row.prompt_id} | ${row.tags.slice(0, -1).join(', ')} | ${row.grade.pass === 1 ? 'pass' : '**fail**'} | ${row.model_calls} | ${row.latency_s} | ${row.words} |`,
    ),
    '',
  ];
  return lines.join('\n') + (input.notes.trim() ? `\n${input.notes.trim()}\n` : '');
}
