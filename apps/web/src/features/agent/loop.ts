/**
 * Asks one question: sends the conversation, runs any tools the assistant
 * asks for against the engine, sends the results back, and repeats until the
 * answer is finished. The tools are the real ones (packages/agent run.ts),
 * whichever transport is used.
 */
import { AGENT_LIMITS, codesInResult } from '@slip/agent';
import { runTool, type Proposal, type ToolEngine } from '@slip/agent/run';
import type { AgentTransport, Message } from './transport.ts';

export interface Step {
  tool: string;
  /** The input, in a few words: an activity code, "previous", or "". */
  input: string;
  /** What came back, in a few words. */
  result: string;
  isError: boolean;
}

export interface Answer {
  question: string;
  status: 'working' | 'done' | 'error' | 'stopped';
  steps: Step[];
  /** The answer so far. Citations are written #CODE. */
  text: string;
  /** Activity codes the tool results contained: the only ones that count as verified. */
  known: string[];
  proposals: Proposal[];
  scripted: boolean;
  /** Milliseconds the question took, once finished. */
  elapsedMs: number;
  error: string;
}

function inputWords(input: unknown): string {
  if (typeof input !== 'object' || input === null) return '';
  const values = Object.values(input as Record<string, unknown>).filter(
    (value) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean',
  );
  return values.slice(0, 3).join(', ').slice(0, 60);
}

/** A few words on a tool result: how many rows, or what failed. */
function resultWords(content: string, isError: boolean): string {
  try {
    const value = JSON.parse(content) as Record<string, unknown>;
    if (isError) return String(value.error ?? 'failed').slice(0, 80);
    if (typeof value.total === 'number') return `${value.total} found`;
    if (Array.isArray(value.contributors)) return `${value.contributors.length} causes`;
    if (Array.isArray(value.checks)) return `${value.checks.length} checks`;
    if (typeof value.activities_changed === 'number') return `${value.activities_changed} changed`;
    return 'done';
  } catch {
    return isError ? 'failed' : 'done';
  }
}

export async function ask(options: {
  transport: AgentTransport;
  engine: ToolEngine;
  /** The conversation so far; the question and everything after it are appended. */
  messages: Message[];
  question: string;
  signal: AbortSignal;
  onUpdate: (answer: Answer) => void;
  now?: () => number;
}): Promise<Answer> {
  const { transport, engine, messages, question, signal, onUpdate } = options;
  const now = options.now ?? (() => performance.now());
  const started = now();
  const known = new Set<string>();
  let answer: Answer = {
    question,
    status: 'working',
    steps: [],
    text: '',
    known: [],
    proposals: [],
    scripted: transport.scripted,
    elapsedMs: 0,
    error: '',
  };
  const update = (patch: Partial<Answer>) => {
    answer = { ...answer, ...patch, known: [...known], elapsedMs: now() - started };
    onUpdate(answer);
  };
  messages.push({ role: 'user', content: question.slice(0, AGENT_LIMITS.questionCharacters) });
  update({});

  for (let call = 1; ; call++) {
    if (signal.aborted) {
      update({ status: 'stopped' });
      return answer;
    }
    const requests: {
      toolUseId: string;
      name: string;
      input: unknown;
      valid: boolean;
      problem?: string;
    }[] = [];
    let finished: 'end_turn' | 'tool_use' | null = null;
    try {
      for await (const event of transport.send(messages, signal)) {
        if (event.type === 'text-delta') update({ text: answer.text + event.text });
        else if (event.type === 'tool-request') requests.push(event);
        else if (event.type === 'error') {
          update({ status: 'error', error: event.message });
          return answer;
        } else {
          messages.push({ role: 'assistant', content: event.assistant });
          finished = event.stopReason;
        }
      }
    } catch {
      update({
        status: signal.aborted ? 'stopped' : 'error',
        error: signal.aborted ? '' : 'The answer stopped part way.',
      });
      return answer;
    }
    if (finished === null) {
      update({ status: 'error', error: 'The answer ended without finishing.' });
      return answer;
    }
    if (finished === 'end_turn') {
      update({ status: 'done' });
      return answer;
    }
    if (call >= AGENT_LIMITS.callsPerQuestion) {
      update({
        status: 'error',
        error: 'The assistant used all the steps it is allowed for one question.',
      });
      return answer;
    }
    const results: unknown[] = [];
    for (const request of requests) {
      const outcome = request.valid
        ? await runTool(engine, request.name, request.input)
        : {
            content: JSON.stringify({
              error: request.problem ?? 'The input did not fit the tool.',
            }),
            isError: true,
            codes: [] as string[],
          };
      for (const code of outcome.codes) known.add(code);
      // Codes inside a result count too, such as the causes in a trace.
      if (!outcome.isError) {
        try {
          codesInResult(JSON.parse(outcome.content), known);
        } catch {
          // Not JSON: nothing to collect.
        }
      }
      const proposals =
        'proposal' in outcome && outcome.proposal
          ? [...answer.proposals, outcome.proposal]
          : answer.proposals;
      update({
        steps: [
          ...answer.steps,
          {
            tool: request.name,
            input: inputWords(request.input),
            result: resultWords(outcome.content, outcome.isError),
            isError: outcome.isError,
          },
        ],
        proposals,
      });
      results.push({
        type: 'tool_result',
        tool_use_id: request.toolUseId,
        content: outcome.content,
        ...(outcome.isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: 'user', content: results });
  }
}
