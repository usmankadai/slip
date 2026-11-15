/**
 * Every request under /api goes to the agent server (apps/api). Vercel deploys each file in this
 * folder as a function; this one catches every path. `_agent.mjs` is the server bundled into one
 * file by `pnpm build` (`build:vercel` in apps/api), because Vercel cannot follow the workspace's
 * TypeScript imports. Files starting with an underscore are not functions.
 */
export { default } from './_agent.mjs';
