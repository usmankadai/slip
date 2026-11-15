/**
 * The agent server as a Vercel Function, mounted under /api so the browser reaches it on the app's
 * own origin. The root file api/[...path].ts re-exports this; Vercel calls its fetch handler.
 */
import { Hono } from 'hono';
import { createApp } from './app.ts';
import { depsFromEnv } from './config.ts';

const app = new Hono().basePath('/api');
app.route('/', createApp(depsFromEnv(process.env)));

export default app;
