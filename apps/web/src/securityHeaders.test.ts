import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '../../../config/securityHeaders.ts';
import vercel from '../../../vercel.json';

// Ported from parity (src/__tests__/securityHeaders.test.ts).
describe('security headers', () => {
  it('are the same in vercel.json as in config/securityHeaders.ts', () => {
    const allRoutes = vercel.headers.find((rule) => rule.source === '/(.*)');
    expect(allRoutes?.headers).toEqual(SECURITY_HEADERS);
  });

  it('allow our own workers and origin, and nothing inline or evaluated', () => {
    const csp = SECURITY_HEADERS.find((header) => header.key === 'Content-Security-Policy')?.value;
    const directives = new Map(
      (csp ?? '').split('; ').map((directive) => {
        const [name = '', ...values] = directive.split(' ');
        return [name, values];
      }),
    );

    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('worker-src')).toEqual(["'self'"]);
    expect(directives.get('connect-src')).toEqual(["'self'"]);
    expect(directives.get('script-src')).toEqual(["'self'"]);
    expect(directives.get('style-src')).toEqual(["'self'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('*');
  });

  it('cache hashed assets for a year and never the page itself', () => {
    const cache = (source: string) =>
      vercel.headers
        .find((rule) => rule.source === source)
        ?.headers.find((header) => header.key === 'Cache-Control')?.value;
    expect(cache('/assets/(.*)')).toBe('public, max-age=31536000, immutable');
    expect(cache('/')).toBe('no-cache');
  });
});
