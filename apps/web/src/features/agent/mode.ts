import type { AssistantMode } from '../dataflow/flows.ts';

/**
 * Which assistant this build uses. The conversation picks its transport from this, and the
 * "Where your data goes" panel describes it, so the two cannot disagree. Scripted is the public
 * default (D11); the live server is not deployed.
 */
export const ASSISTANT_MODE: AssistantMode = 'scripted';
