import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { SECURITY_HEADERS } from '../../config/securityHeaders.ts';

export default defineConfig({
  plugins: [react()],
  // Vercel sets the commit when it builds. Locally it is empty and the footer says so.
  define: { __BUILD_COMMIT__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? '') },
  worker: { format: 'es' },
  // Never inline an asset as a data: URI. The small font subsets would otherwise be
  // inlined, and the Content Security Policy only allows fonts from our own origin.
  build: { assetsInlineLimit: 0 },
  // Serve the production headers when previewing the build, so the perf and
  // end-to-end suites run under the same Content Security Policy as production.
  preview: {
    headers: Object.fromEntries(SECURITY_HEADERS.map(({ key, value }) => [key, value])),
  },
});
