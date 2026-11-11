/** The one engine worker for the app. Created on first use, so a page that never imports never starts it. */
import { EngineClient } from '../workers/engineClient.ts';

let client: EngineClient | null = null;

export function engine(): EngineClient {
  client ??= new EngineClient();
  return client;
}
