/**
 * GET /api/health: the agent server (apps/api), bundled into `_agent.mjs` by `pnpm build`.
 * One file per route: a catch-all file here matched only one path segment on Vercel.
 */
export { default } from './_agent.mjs';
