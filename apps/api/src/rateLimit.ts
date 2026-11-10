/**
 * Two guards on the agent endpoint: a per-visitor limit on questions, and a
 * cap on model calls per day across everyone.
 *
 * With Upstash Redis configured, both are shared by every server instance.
 * Without it they live in memory: each instance counts separately and a
 * cold start resets them. That is a demo guard against casual abuse, not
 * real protection, and the server says so at start-up.
 *
 * The in-memory limiter is ported from parity (api/_lib/rateLimit.ts).
 */

export type LimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface Guards {
  /** Records a question from a visitor and says whether it is allowed. */
  question(key: string, now: number): Promise<LimitResult>;
  /** Records a model call and says whether today's cap still has room. */
  modelCall(now: number): Promise<LimitResult>;
  /** True when the counts are shared across instances. */
  shared: boolean;
}

export interface GuardOptions {
  questionLimit: number;
  windowMs: number;
  dailyCalls: number;
}

/** A simple per-key limit: at most `limit` requests in a sliding `windowMs`. */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();
  return {
    check(key: string, now: number): LimitResult {
      const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        const oldest = recent[0] ?? now;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
        };
      }
      recent.push(now);
      hits.set(key, recent);
      // Keep the map from growing without bound on a long-lived instance.
      if (hits.size > 10_000) {
        for (const [other, times] of hits)
          if (times.every((time) => now - time >= windowMs)) hits.delete(other);
      }
      return { allowed: true };
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** The UTC day a moment falls in, as "2026-11-10". */
export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);
const secondsToNextUtcDay = (now: number) =>
  Math.max(1, Math.ceil((DAY_MS - (now % DAY_MS)) / 1000));

export function createMemoryGuards(options: GuardOptions): Guards {
  const limiter = createRateLimiter({ limit: options.questionLimit, windowMs: options.windowMs });
  let day = '';
  let calls = 0;
  return {
    shared: false,
    async question(key, now) {
      return limiter.check(key, now);
    },
    async modelCall(now) {
      const today = utcDay(now);
      if (today !== day) {
        day = today;
        calls = 0;
      }
      if (calls >= options.dailyCalls)
        return { allowed: false, retryAfterSeconds: secondsToNextUtcDay(now) };
      calls++;
      return { allowed: true };
    },
  };
}

/**
 * The same two guards on Upstash Redis, over its REST API with plain fetch
 * (no SDK, as in switchboard). If Redis cannot be reached the request is
 * allowed and the failure is logged: an outage of the counter should not
 * take the assistant down, and the spending limit on the API key remains.
 */
export function createUpstashGuards(
  options: GuardOptions & { url: string; token: string; log: (message: string) => void },
  fetcher: typeof fetch = fetch,
): Guards {
  const pipeline = async (commands: (string | number)[][]): Promise<unknown[] | null> => {
    try {
      const response = await fetcher(`${options.url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commands),
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) {
        options.log(`rate limit store answered ${response.status}`);
        return null;
      }
      const results = (await response.json()) as { result?: unknown }[];
      return results.map((entry) => entry.result);
    } catch {
      options.log('rate limit store could not be reached');
      return null;
    }
  };
  return {
    shared: true,
    async question(key, now) {
      // A sorted set of this visitor's recent questions, scored by time.
      const name = `slip:q:${key}`;
      const results = await pipeline([
        ['ZREMRANGEBYSCORE', name, 0, now - options.windowMs],
        ['ZCARD', name],
        ['ZRANGE', name, 0, 0, 'WITHSCORES'],
      ]);
      if (!results) return { allowed: true };
      const count = Number(results[1] ?? 0);
      if (count >= options.questionLimit) {
        const oldest = Number((results[2] as unknown[] | undefined)?.[1] ?? now);
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000)),
        };
      }
      await pipeline([
        ['ZADD', name, now, `${now}-${Math.random().toString(36).slice(2, 10)}`],
        ['PEXPIRE', name, options.windowMs],
      ]);
      return { allowed: true };
    },
    async modelCall(now) {
      const name = `slip:calls:${utcDay(now)}`;
      const results = await pipeline([
        ['INCR', name],
        ['EXPIRE', name, 2 * 24 * 60 * 60],
      ]);
      if (!results) return { allowed: true };
      return Number(results[0] ?? 0) > options.dailyCalls
        ? { allowed: false, retryAfterSeconds: secondsToNextUtcDay(now) }
        : { allowed: true };
    },
  };
}

/** The caller's IP, from the first entry of x-forwarded-for (set by the host). */
export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
