/** Local entry point: `pnpm --filter @slip/api dev`. Deployment wiring comes with the first deploy. */
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { depsFromEnv } from './config.ts';

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createApp(depsFromEnv(process.env)).fetch, port });
console.log(JSON.stringify({ event: 'listening', port }));
