/**
 * Serves the built Storybook for the screenshot suite. A copy of the small server in tools/a11y,
 * kept here so each tool runs on its own.
 *
 * Usage: node src/serve.ts <storybook-static> <port>
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.argv[2] ?? '../../packages/ui/storybook-static');
const PORT = Number(process.argv[3] ?? 6007);
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

createServer((request, response) => {
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
}).listen(PORT, '127.0.0.1');
