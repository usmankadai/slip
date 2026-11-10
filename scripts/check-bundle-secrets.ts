// Fails the build if anything that looks like a secret, or the name of a
// server-only variable, ends up in the browser bundle.
// Ported from parity (scripts/check-bundle-secrets.ts).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = process.argv[2] ?? 'apps/web/dist';

/** Each entry is a pattern and why it must not appear. */
export const FORBIDDEN: [RegExp, string][] = [
  [/sk-ant-[a-z0-9]/i, 'an Anthropic API key'],
  [/ANTHROPIC_API_KEY/, 'the name of the server-only Anthropic key variable'],
  [/UPSTASH_REDIS_REST_TOKEN/, 'the name of the server-only Redis token variable'],
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

if (!existsSync(DIST)) {
  console.error(`Secrets check failed: ${DIST} does not exist. Build the app first.`);
  process.exit(1);
}

const all = files(DIST);
const problems = all
  .filter((path) => /\.(js|html|css|map|json|txt)$/.test(path))
  .flatMap((path) => {
    const text = readFileSync(path, 'utf8');
    return FORBIDDEN.filter(([pattern]) => pattern.test(text)).map(
      ([, why]) => `${path}: contains ${why}`,
    );
  });

if (problems.length > 0) {
  console.error('Secrets check failed. The browser bundle must never contain these:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`Secrets check passed (${all.length} files in ${DIST}).`);
