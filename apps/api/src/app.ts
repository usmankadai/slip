/**
 * The agent server: two routes on Hono. Everything it needs from outside
 * is in `deps`, so tests build the same app with fakes.
 */
import { Hono } from 'hono';
import { handleChat, type ChatDeps } from './handleChat.ts';

export interface AppDeps extends ChatDeps {
  /** The one origin allowed to call the API from a browser, for example "https://slip.example". */
  appOrigin: string | undefined;
  commit: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '600',
  Vary: 'Origin',
};

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  // Browsers send Origin on cross-origin and on every POST. Only our own app may call this API.
  app.use('*', async (c, next) => {
    const origin = c.req.header('origin');
    if (origin !== undefined && origin !== deps.appOrigin) {
      return c.json({ code: 'origin', message: 'This origin may not use the assistant.' }, 403);
    }
    if (c.req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, 'Access-Control-Allow-Origin': origin ?? '' },
      });
    }
    await next();
    if (origin !== undefined) {
      c.res.headers.set('Access-Control-Allow-Origin', origin);
      c.res.headers.set('Vary', 'Origin');
    }
  });

  app.post('/agent/chat', (c) => handleChat(c.req.raw, deps));

  // Says which optional parts are configured, as true or false, never their values.
  app.get('/health', (c) =>
    c.json(
      {
        commit: deps.commit,
        live: deps.env.live && Boolean(deps.env.apiKey) && Boolean(deps.env.model),
        sharedLimits: deps.guards.shared,
      },
      200,
      { 'Cache-Control': 'no-store' },
    ),
  );

  app.notFound((c) => c.json({ code: 'bad-request', message: 'Not found.' }, 404));
  app.onError((_error, c) => {
    deps.log({ event: 'unhandled-error' });
    return c.json({ code: 'bad-request', message: 'The request could not be handled.' }, 500);
  });
  return app;
}
