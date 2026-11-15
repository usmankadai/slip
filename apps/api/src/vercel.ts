/**
 * The agent server as a Vercel Function, mounted under /api so the browser reaches it on the app's
 * own origin. `pnpm build` bundles this into api/_agent.mjs, which api/health.js and
 * api/agent/chat.js re-export, one function per route; Vercel calls its fetch handler.
 */
import { Hono } from 'hono';
import { createApp } from './app.ts';
import { depsFromEnv } from './config.ts';

const app = new Hono().basePath('/api');
app.route('/', createApp(depsFromEnv(process.env)));

export default app;
