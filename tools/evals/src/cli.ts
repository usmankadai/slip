/**
 * The eval runner.
 *
 *   pnpm evals:list                      write the cases to docs/evals-cases.md, for review. Free.
 *   pnpm evals -- --pilot                run four cases live. Costs money.
 *   pnpm evals                           run every case live and write docs/evals.md. Costs money.
 *   pnpm evals -- --cases slip-why,...   run named cases.   --reps 2   --variant v1   --timeout-s 240
 *   --record                             also save each graded answer under recorded/, for replay in the checks
 *
 * Results go to tools/evals/results/<variant>/: one row per (case, rep) in
 * results.jsonl, the full exchange in traces/, and harness failures in
 * errors.jsonl. A run can be stopped and restarted; finished rows are kept.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createApp } from '@slip/api/app';
import { depsFromEnv } from '@slip/api/config';
import { buildCases, type EvalCase } from './cases.ts';
import { buildFixture } from './fixture.ts';
import { gradeCase } from './grade.ts';
import { HarnessError, runAgent } from './runAgent.ts';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..', '..');
const { values } = parseArgs({
  options: {
    list: { type: 'boolean', default: false },
    pilot: { type: 'boolean', default: false },
    record: { type: 'boolean', default: false },
    cases: { type: 'string' },
    reps: { type: 'string', default: '1' },
    variant: { type: 'string', default: 'baseline' },
    'timeout-s': { type: 'string', default: '240' },
    activities: { type: 'string', default: '10000' },
  },
});

const fixture = buildFixture(Number(values.activities));
const allCases = buildCases(fixture.truth);
const PILOT = ['slip-why', 'propose-shorten', 'decline-cost', 'inject-canary'];

function listCases(cases: EvalCase[]): string {
  const fence = '````';
  const lines = [
    '# Agent eval: the cases',
    '',
    `Written by \`pnpm evals:list\`. ${cases.length} questions over a generated ${fixture.options.activities.toLocaleString('en-GB')} activity rail pair (seed ${fixture.options.seed}).`,
    "Every expected value comes from the generator's record of what it changed, or from the engine. None comes from a model.",
    '',
    '| Case | Kind | File | Must contain | Proposal |',
    '|---|---|---|---|---|',
    ...cases.map((test) => {
      const e = test.expect;
      const needs = [
        e.numbers?.length ? `numbers ${e.numbers.join(', ')}` : '',
        e.dates?.length ? `dates ${e.dates.join(', ')}` : '',
        e.cite?.length ? `cites ${e.cite.length} code(s)` : '',
        e.citeSome ? `cites ${e.citeSome.count} of ${e.citeSome.codes.length}` : '',
        e.mustDecline
          ? 'says the schedule does not hold this'
          : e.says?.length
            ? `${e.says.length} statement(s)`
            : '',
        e.mustNotSay?.length ? `${e.mustNotSay.length} forbidden` : '',
      ]
        .filter(Boolean)
        .join('; ');
      const proposal = e.proposal === 'none' ? 'none' : `one, on ${e.proposal.taskCode}`;
      return `| ${test.id} | ${test.tags.join(', ')} | ${test.variant} | ${needs} | ${proposal} |`;
    }),
    '',
    ...cases.flatMap((test) => [
      `## ${test.id}`,
      '',
      test.why,
      '',
      fence,
      test.question,
      fence,
      '',
      'Expected:',
      '',
      '```json',
      JSON.stringify(test.expect, null, 2),
      '```',
      '',
    ]),
  ];
  return lines.join('\n');
}

if (values.list) {
  writeFileSync(join(ROOT, 'docs', 'evals-cases.md'), listCases(allCases));
  console.log(`Wrote docs/evals-cases.md (${allCases.length} cases).`);
  process.exit(0);
}

const wanted = values.cases
  ? values.cases.split(',')
  : values.pilot
    ? PILOT
    : allCases.map((test) => test.id);
const cases = allCases.filter((test) => wanted.includes(test.id));
const unknown = wanted.filter((id) => !allCases.some((test) => test.id === id));
if (unknown.length > 0 || cases.length === 0) {
  console.error(`Unknown case(s): ${unknown.join(', ') || '(none selected)'}`);
  process.exit(1);
}
const reps = Math.max(1, Number(values.reps) || 1);
const timeoutMs = (Number(values['timeout-s']) || 240) * 1000;
const variant = values.variant;
if (!/^(baseline|v\d+)$/.test(variant)) {
  console.error('The variant must be "baseline" or "v1", "v2", ...');
  process.exit(1);
}

const out = join(here, '..', 'results', variant);
mkdirSync(join(out, 'traces'), { recursive: true });
const resultsFile = join(out, 'results.jsonl');
const errorsFile = join(out, 'errors.jsonl');
const finished = new Set(
  existsSync(resultsFile)
    ? readFileSync(resultsFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const row = JSON.parse(line) as { prompt_id: string; rep: number };
          return `${row.prompt_id}#${row.rep}`;
        })
    : [],
);

// The real server, in process. Limits are raised for the run; each case is its own visitor.
const ORIGIN = 'http://localhost:5173';
const logLines: Record<string, string | number | boolean>[] = [];
const deps = depsFromEnv(
  {
    ...process.env,
    AGENT_MODE: 'live',
    APP_ORIGIN: ORIGIN,
    AGENT_QUESTIONS_PER_WINDOW: '100000',
    AGENT_DAILY_CALL_CAP: '100000',
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined,
  },
  (line) => logLines.push(JSON.parse(line) as Record<string, string | number | boolean>),
);
if (!deps.env.apiKey || !deps.env.model) {
  console.error(
    'ANTHROPIC_API_KEY and ANTHROPIC_MODEL must be set (see .env.example). Nothing was run.',
  );
  process.exit(1);
}
const app = createApp(deps);
const requested = deps.env.model;

let ran = 0;
for (const test of cases) {
  for (let rep = 0; rep < reps; rep++) {
    if (finished.has(`${test.id}#${rep}`)) continue;
    logLines.length = 0;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const usage = () => {
      const turns = logLines.filter((line) => line.event === 'turn');
      const sum = (key: string) => turns.reduce((total, line) => total + Number(line[key] ?? 0), 0);
      return {
        models: [...new Set(turns.map((line) => String(line.model)))],
        usage: {
          input_tokens: sum('inputTokens'),
          output_tokens: sum('outputTokens'),
          cache_read_input_tokens: sum('cacheReadTokens'),
          cache_creation_input_tokens: sum('cacheWriteTokens'),
        },
      };
    };
    try {
      const run = await runAgent(
        app,
        fixture.session(test.variant),
        test.question,
        `eval-${test.id}-${rep}`,
        ORIGIN,
        controller.signal,
      );
      const served = usage();
      // A turn served by another model (a fallback, a reroute) would measure something else.
      const wrongModel = served.models.find((model) => !model.startsWith(requested));
      if (wrongModel)
        throw new HarnessError('model-error', `Served by ${wrongModel}, not ${requested}.`);
      if (served.usage.output_tokens === 0)
        throw new HarnessError('model-error', 'No token usage was recorded for the case.');
      const { grade, explanation } = gradeCase(test, run);
      writeFileSync(
        join(out, 'traces', `${test.id}_rep${rep}.json`),
        JSON.stringify(run.trace, null, 2),
      );
      appendFileSync(
        resultsFile,
        JSON.stringify({
          prompt_id: test.id,
          rep,
          prompt: test.question,
          tags: [...test.tags, test.variant],
          status: 'ok',
          stop_reason: run.stopReason,
          grade,
          explanation,
          model: served.models[0],
          usage: served.usage,
          latency_s: run.latencyS,
          tool_calls: run.toolCalls,
          model_calls: run.modelCalls,
          words: run.words,
          tool_result_bytes: run.toolResultBytes,
          answer: run.answer,
          // Enough to grade the answer again later without the model.
          run: {
            answer: run.answer,
            knownCodes: run.knownCodes,
            proposals: run.proposals,
            editsInForce: run.editsInForce,
          },
        }) + '\n',
      );
      if (values.record) {
        // A committed copy of a real answer, so the graders are exercised on model output in the normal checks.
        mkdirSync(join(here, '..', 'recorded'), { recursive: true });
        writeFileSync(
          join(here, '..', 'recorded', `${test.id}.json`),
          JSON.stringify(
            {
              prompt_id: test.id,
              model: served.models[0],
              grade,
              run: {
                answer: run.answer,
                knownCodes: run.knownCodes,
                proposals: run.proposals,
                editsInForce: run.editsInForce,
              },
            },
            null,
            2,
          ) + '\n',
        );
      }
      ran++;
      console.log(
        `${grade.pass === 1 ? 'pass' : 'FAIL'}  ${test.id}${reps > 1 ? ` #${rep}` : ''}  ${run.modelCalls} calls, ${run.latencyS}s, ${run.words} words${
          grade.pass === 1
            ? ''
            : `  ${Object.entries(explanation)
                .filter(([id]) => id !== 'pass' && grade[id as keyof typeof grade] === 0)
                .map(([id, why]) => `[${id}] ${why}`)
                .join(' ')}`
        }`,
      );
    } catch (error) {
      const failure =
        error instanceof HarnessError
          ? error.failure
          : controller.signal.aborted
            ? 'timeout'
            : 'harness-error';
      const served = usage();
      appendFileSync(
        errorsFile,
        JSON.stringify({
          prompt_id: test.id,
          rep,
          failure,
          message: error instanceof Error ? error.message : 'unknown',
          model: served.models[0] ?? null,
          usage: served.usage,
        }) + '\n',
      );
      console.log(
        `ERROR ${test.id}  ${failure}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

// Summary, recomputed from the rows on disk.
interface Row {
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
const rows = readFileSync(resultsFile, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as Row)
  .filter((row) => cases.some((test) => test.id === row.prompt_id));
const errors = existsSync(errorsFile)
  ? readFileSync(errorsFile, 'utf8').split('\n').filter(Boolean).length
  : 0;
const n = rows.length;
const passed = rows.filter((row) => row.grade.pass === 1).length;
// Wilson 95% interval for a pass rate.
const z = 1.96;
const p = n ? passed / n : 0;
const centre = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
const median = (list: number[]) => {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
};
const tokens = (key: string) => rows.reduce((total, row) => total + (row.usage[key] ?? 0), 0);
const PRICES: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};
const price = Object.entries(PRICES).find(([model]) => requested.startsWith(model))?.[1];
const cost = price
  ? (tokens('input_tokens') * price[0] +
      tokens('output_tokens') * price[1] +
      tokens('cache_read_input_tokens') * price[0] * 0.1 +
      tokens('cache_creation_input_tokens') * price[0] * 1.25) /
    1e6
  : null;
const summary = [
  `${passed} of ${n} passed (${n ? Math.round(p * 100) : 0}%, 95% interval ${n ? Math.round((centre - half) * 100) : 0} to ${n ? Math.round((centre + half) * 100) : 0}%). ${errors} harness error(s) on record, not counted.`,
  `Per question, median: ${median(rows.map((row) => row.latency_s))}s, ${median(rows.map((row) => row.model_calls))} model calls, ${median(rows.map((row) => row.words))} words, ${median(rows.map((row) => row.tool_result_bytes))} bytes of tool results.`,
  `Tokens: ${tokens('input_tokens')} input, ${tokens('output_tokens')} output, ${tokens('cache_read_input_tokens')} cache read, ${tokens('cache_creation_input_tokens')} cache write.${cost === null ? '' : ` About $${cost.toFixed(2)} at list prices, $${n ? (cost / n).toFixed(3) : '0'} per question.`}`,
];
console.log(`\n${variant} on ${requested}, ${ran} new row(s) this run\n${summary.join('\n')}`);
