/**
 * Every request under /api goes to the agent server (apps/api). Vercel deploys each file in this
 * folder as a function; this one catches every path and hands it to the Hono app, which streams.
 */
export { default } from '../apps/api/src/vercel.ts';
