/** Reads the server's settings from the environment and builds the real dependencies. */
import type { AppDeps } from './app.ts';
import { EFFORTS, describeModelError, streamFromClaude, type Effort } from './claudeStream.ts';
import { createMemoryGuards, createUpstashGuards } from './rateLimit.ts';

type Env = Record<string, string | undefined>;

const positive = (value: string | undefined, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
};

export function depsFromEnv(env: Env, write: (line: string) => void = console.log): AppDeps {
  const log: AppDeps['log'] = (line) => write(JSON.stringify(line));
  const limits = {
    questionLimit: positive(env.AGENT_QUESTIONS_PER_WINDOW, 20),
    windowMs: positive(env.AGENT_WINDOW_MINUTES, 10) * 60 * 1000,
    dailyCalls: positive(env.AGENT_DAILY_CALL_CAP, 2000),
  };
  const redis = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN;
  const guards = redis
    ? createUpstashGuards({
        ...limits,
        url: env.UPSTASH_REDIS_REST_URL!,
        token: env.UPSTASH_REDIS_REST_TOKEN!,
        log: (message) => log({ event: 'rate-limit-store', detail: message }),
      })
    : createMemoryGuards(limits);
  const effort = (EFFORTS as readonly string[]).includes(env.AGENT_EFFORT ?? '')
    ? (env.AGENT_EFFORT as Effort)
    : 'medium';
  const live = env.AGENT_MODE === 'live';
  log({
    event: 'start',
    live: live && Boolean(env.ANTHROPIC_API_KEY) && Boolean(env.ANTHROPIC_MODEL),
    limits: redis ? 'shared (Redis)' : 'in memory: demo guard only',
  });
  return {
    env: { apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL, live, effort },
    streamModel: streamFromClaude,
    guards,
    describeError: describeModelError,
    log,
    now: () => Date.now(),
    appOrigin: env.APP_ORIGIN,
    commit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? env.COMMIT ?? 'dev',
  };
}
