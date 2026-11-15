/**
 * Runs axe on every story in the built Storybook and fails on any serious or
 * critical violation (design-system spec). Stories cover every component and
 * every screen state, so this is the accessibility check for the UI.
 *
 * Usage: node tools/a11y/src/run.ts [path to storybook-static]
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(
  process.argv[2] ?? new URL('../../../packages/ui/storybook-static', import.meta.url).pathname,
);
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

if (!existsSync(join(ROOT, 'index.json'))) {
  console.error(`No Storybook build at ${ROOT}. Run pnpm build:storybook first.`);
  process.exit(1);
}

const server = createServer((request, response) => {
  const path = normalize(decodeURIComponent((request.url ?? '/').split('?')[0]!)).replace(
    /^(\.\.[/\\])+/,
    '',
  );
  let file = join(ROOT, path);
  if (!file.startsWith(ROOT)) {
    response.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
const address = server.address();
const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

const index = JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8')) as {
  entries: Record<string, { id: string; title: string; name: string; type: string }>;
};
const stories = Object.values(index.entries).filter((entry) => entry.type === 'story');

interface Finding {
  story: string;
  rule: string;
  impact: string;
  help: string;
  targets: string[];
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const findings: Finding[] = [];
const minor: Finding[] = [];
for (const story of stories) {
  await page.goto(`${base}/iframe.html?id=${story.id}&viewMode=story`);
  await page.waitForFunction(
    () => (document.querySelector('#storybook-root')?.childElementCount ?? 0) > 0,
    null,
    {
      timeout: 15_000,
    },
  );
  await page.waitForTimeout(150);
  await page.addScriptTag({ path: AXE });
  const result = (await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run: (context: unknown, options: unknown) => Promise<unknown> };
      }
    ).axe;
    return axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
  })) as {
    violations: { id: string; impact: string; help: string; nodes: { target: string[] }[] }[];
  };
  for (const violation of result.violations) {
    const finding = {
      story: `${story.title} / ${story.name}`,
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
    };
    (violation.impact === 'serious' || violation.impact === 'critical' ? findings : minor).push(
      finding,
    );
  }
}
await browser.close();
server.close();

for (const finding of minor) {
  console.log(`note  ${finding.story}: ${finding.rule} (${finding.impact}) ${finding.help}`);
}
for (const finding of findings) {
  console.log(
    `FAIL  ${finding.story}: ${finding.rule} (${finding.impact}) ${finding.help}\n      ${finding.targets.join('\n      ')}`,
  );
}
console.log(
  `axe checked ${stories.length} stories: ${findings.length} serious or critical, ${minor.length} minor or moderate.`,
);
process.exit(findings.length > 0 ? 1 : 0);
