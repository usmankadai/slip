/**
 * Runs one question through the agent exactly as the browser will: the real
 * server handler, the real tools, the real engine. Only the network hop to
 * the server is skipped (the app is called in process).
 */
import { AGENT_LIMITS, type AgentEvent } from '@slip/agent';
import { runTool, type ToolEngine } from '@slip/agent/run';
import type { EngineRequest, EngineSession } from '@slip/engine';
import type { Run } from './grade.ts';

export interface TraceTurn {
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content: string;
  name?: string;
}

export interface AgentRun extends Run {
  trace: TraceTurn[];
  /** Calls to the model for this question. */
  modelCalls: number;
  toolCalls: number;
  /** Bytes of tool results sent to the model: how much of the schedule left the machine. */
  toolResultBytes: number;
  /** Wall time for the whole question, including tools. */
  latencyS: number;
  words: number;
  /** The last stop reason the server reported. */
  stopReason: string;
}

/** A failure of the harness or the service, as opposed to a wrong answer. */
export class HarnessError extends Error {
  readonly failure: 'refused-by-server' | 'model-error' | 'step-limit' | 'timeout';

  constructor(failure: HarnessError['failure'], message: string) {
    super(message);
    this.name = 'HarnessError';
    this.failure = failure;
  }
}

interface App {
  request(path: string, init: RequestInit): Response | Promise<Response>;
}

export async function runAgent(
  app: App,
  session: EngineSession,
  question: string,
  visitor: string,
  origin: string,
  signal: AbortSignal,
): Promise<AgentRun> {
  const started = performance.now();
  const engine = {
    request: async (request: EngineRequest) => session.handle(request),
  } as ToolEngine;
  const messages: unknown[] = [{ role: 'user', content: question }];
  const trace: TraceTurn[] = [{ role: 'user', content: question }];
  const known = new Set<string>();
  const proposals: Run['proposals'] = [];
  let answer: string;
  let stopReason: string;
  let modelCalls = 0;
  let toolCalls = 0;
  let toolResultBytes = 0;

  for (;;) {
    if (signal.aborted) throw new HarnessError('timeout', 'The case ran out of time.');
    const response = await app.request('/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin, 'x-forwarded-for': visitor },
      body: JSON.stringify({ messages }),
      signal,
    });
    const text = await response.text();
    if (!response.headers.get('content-type')?.startsWith('text/event-stream')) {
      const code = (JSON.parse(text) as { code?: string }).code ?? 'unknown';
      throw new HarnessError(
        code === 'step-limit' ? 'step-limit' : 'refused-by-server',
        `The server refused the request: ${code}.`,
      );
    }
    modelCalls++;
    const events = text
      .split('\n\n')
      .filter(Boolean)
      .map((chunk) => JSON.parse(chunk.replace(/^data: /, '')) as AgentEvent);
    const failure = events.find((event) => event.type === 'error');
    if (failure && failure.type === 'error') {
      // A refusal by the model is an answer of a kind; anything else is the service failing.
      if (failure.code !== 'refused')
        throw new HarnessError('model-error', `The model call failed: ${failure.code}.`);
      stopReason = 'refusal';
      answer = '';
      break;
    }
    const said = events
      .filter((event) => event.type === 'text-delta')
      .map((event) => (event.type === 'text-delta' ? event.text : ''))
      .join('');
    const done = events.find((event) => event.type === 'done');
    if (!done || done.type !== 'done')
      throw new HarnessError('model-error', 'The stream ended without a final event.');
    stopReason = done.stopReason;
    messages.push({ role: 'assistant', content: done.assistant });
    if (done.stopReason === 'end_turn') {
      answer = said;
      trace.push({ role: 'assistant', content: said });
      break;
    }
    if (said.trim()) trace.push({ role: 'assistant', content: said });
    const results: unknown[] = [];
    for (const event of events) {
      if (event.type !== 'tool-request') continue;
      toolCalls++;
      trace.push({
        role: 'tool_call',
        name: event.name,
        content: JSON.stringify(event.input, null, 2),
      });
      const outcome = event.valid
        ? await runTool(engine, event.name, event.input)
        : {
            content: JSON.stringify({ error: event.problem }),
            isError: true,
            codes: [] as string[],
            proposal: undefined,
          };
      for (const code of outcome.codes) known.add(code);
      if (outcome.proposal) {
        const detail = session.handle({ type: 'activity', taskCode: outcome.proposal.taskCode });
        const dayMinutes = detail.type === 'activity' ? (detail.current?.dayMinutes ?? 480) : 480;
        proposals.push({
          taskCode: outcome.proposal.taskCode,
          field: outcome.proposal.field,
          from: outcome.proposal.from,
          to: outcome.proposal.to,
          dayMinutes,
        });
      }
      toolResultBytes += outcome.content.length;
      trace.push({ role: 'tool_result', content: outcome.content });
      results.push({
        type: 'tool_result',
        tool_use_id: event.toolUseId,
        content: outcome.content,
        ...(outcome.isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: 'user', content: results });
    if (modelCalls > AGENT_LIMITS.callsPerQuestion)
      throw new HarnessError('step-limit', 'The question used all its steps.');
  }

  const edits = session.handle({ type: 'edits' });
  return {
    answer,
    knownCodes: [...known],
    proposals,
    editsInForce: edits.type === 'edits' ? edits.edits.length : 0,
    trace,
    modelCalls,
    toolCalls,
    toolResultBytes,
    latencyS: Math.round((performance.now() - started) / 100) / 10,
    words: answer.trim() === '' ? 0 : answer.trim().split(/\s+/).length,
    stopReason,
  };
}
