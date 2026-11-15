/**
 * Whether the assistant answers live or from scripts. The server says, once per page load, through
 * GET /api/health; anything other than a clear yes means scripted (D11). The conversation and the
 * "Where your data goes" panel both read this, so they cannot disagree.
 */
import { useEffect, useState } from 'react';
import type { AssistantMode } from '../dataflow/flows.ts';

let known: Promise<AssistantMode> | null = null;
let current: AssistantMode = 'scripted';
const listeners = new Set<(mode: AssistantMode) => void>();

/** Reads the server's answer. A missing server, an error or anything unexpected is scripted. */
export async function readMode(fetchImpl: typeof fetch = fetch): Promise<AssistantMode> {
  try {
    const response = await fetchImpl('/api/health', { headers: { Accept: 'application/json' } });
    if (!response.ok) return 'scripted';
    const body = (await response.json()) as { live?: unknown };
    return body.live === true ? 'live' : 'scripted';
  } catch {
    return 'scripted';
  }
}

/** The mode, asked for once per page and shared. */
export function assistantMode(): Promise<AssistantMode> {
  known ??= readMode().then((mode) => {
    current = mode;
    for (const listener of listeners) listener(mode);
    return mode;
  });
  return known;
}

/** Live answers are off for the rest of this page: the daily cap was reached, or live was switched off. */
export function switchToScripted(): void {
  current = 'scripted';
  known = Promise.resolve('scripted');
  for (const listener of listeners) listener('scripted');
}

/** The mode, for a component: scripted until the server has answered. */
export function useAssistantMode(): AssistantMode {
  const [mode, setMode] = useState<AssistantMode>(current);
  useEffect(() => {
    listeners.add(setMode);
    void assistantMode().then(setMode);
    return () => {
      listeners.delete(setMode);
    };
  }, []);
  return mode;
}
