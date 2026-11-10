/**
 * Security headers for every response. The same list is used by
 * `vite preview` (so browser tests run under them) and by vercel.json
 * (production). A unit test fails if the two ever differ.
 *
 * Ported from parity (config/securityHeaders.ts).
 */

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // No inline scripts: the build emits only external script files.
  "script-src 'self'",
  // No inline styles either; fonts are self-hosted, so no third-party stylesheets.
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  // Every request goes to our own origin. Add the Sentry ingest host here only when Sentry is configured.
  "connect-src 'self'",
  // The parse, generate and engine workers, and later the MSW service worker for scripted agent mode.
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
];
