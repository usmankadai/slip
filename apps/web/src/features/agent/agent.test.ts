import { describe, expect, it } from 'vitest';
import { splitCitations, type AgentEvent } from '@slip/agent';
import type { ToolEngine } from '@slip/agent/run';
import { EngineSession, type EngineRequest } from '@slip/engine';
import { parseXerText } from '@slip/xer';
import update01 from '../../../../../fixtures/synthetic/rail-1k/update-01.xer?raw';
import update02 from '../../../../../fixtures/synthetic/rail-1k/update-02.xer?raw';
import { ask, type Answer } from './loop.ts';
import { SUGGESTED, scriptedTransport } from './scripted.ts';
import { liveTransport, readEvents, type AgentTransport, type Message } from './transport.ts';

function loaded(): ToolEngine {
  const session = new EngineSession();
  session.handle({ type: 'load', slot: 'a', data: parseXerText(update01) });
  session.handle({ type: 'load', slot: 'b', data: parseXerText(update02) });
  return { request: async (request: EngineRequest) => session.handle(request) } as ToolEngine;
}

async function run(
  question: string,
  transport: AgentTransport = scriptedTransport(),
  engine = loaded(),
): Promise<Answer> {
  return ask({
    transport,
    engine,
    messages: [],
    question,
    signal: new AbortController().signal,
    onUpdate: () => {},
  });
}

const unverified = (answer: Answer) =>
  splitCitations(answer.text, new Set(answer.known)).filter((part) => part.kind === 'unverified');
const cited = (answer: Answer) =>
  splitCitations(answer.text, new Set(answer.known))
    .filter((part) => part.kind === 'verified')
    .map((part) => part.text);

describe('scripted answers on the 1,000 activity fixture', () => {
  it('answers every suggested question, citing only what the tools returned', async () => {
    for (const question of SUGGESTED) {
      const answer = await run(question.text);
      expect(answer.status, question.id).toBe('done');
      expect(answer.scripted).toBe(true);
      expect(answer.steps.length, question.id).toBeGreaterThan(0);
      expect(
        answer.steps.every((step) => !step.isError),
        question.id,
      ).toBe(true);
      expect(unverified(answer), question.id).toEqual([]);
    }
  });

  it('explains the largest slip with the causes in expected.json', async () => {
    const answer = await run(SUGGESTED[0]!.text);
    expect(answer.steps.map((step) => step.tool)).toEqual(['diff_summary', 'trace_slip']);
    expect(answer.text).toContain('67 working days later');
    expect(cited(answer)).toEqual(
      expect.arrayContaining(['P03-A002-ENB-0110', 'P03-A002-TRK-0170', 'P03-A002-CIV-0220']),
    );
  });

  it('runs both health summaries in one step', async () => {
    const answer = await run(SUGGESTED[2]!.text);
    expect(answer.steps.map((step) => step.input)).toEqual(['previous', 'current']);
    expect(answer.text).toMatch(/DCMA check/);
  });

  it('shows a second decimal place when one would hide a real change', async () => {
    const answer = await run(SUGGESTED[2]!.text);
    expect(answer.text).not.toMatch(/\((\d+\.\d)% to \1%\)/);
  });

  it('says plainly that it answers only the suggested questions', async () => {
    const answer = await run('Is the delay the subcontractor’s fault?');
    expect(answer.status).toBe('done');
    expect(answer.steps).toEqual([]);
    expect(answer.text).toContain('answers only the suggested questions');
  });

  it('matches a suggested question however it is spaced or capitalised', async () => {
    const answer = await run(`  ${SUGGESTED[1]!.text.toUpperCase()}  `);
    expect(answer.steps.map((step) => step.tool)).toEqual(['diff_summary']);
  });
});

/** A transport that plays back fixed events, one list per call. */
function playback(calls: AgentEvent[][]): AgentTransport {
  let call = 0;
  return {
    scripted: false,
    async *send() {
      yield* calls[Math.min(call++, calls.length - 1)]!;
    },
  };
}
const done = (stopReason: 'end_turn' | 'tool_use'): AgentEvent => ({
  type: 'done',
  stopReason,
  assistant: [],
  callsUsed: 1,
  callsAllowed: 8,
});

describe('the question loop', () => {
  it('marks a code the tools never returned as unverified', async () => {
    const answer = await run(
      'Why?',
      playback([
        [
          {
            type: 'tool-request',
            toolUseId: 't1',
            name: 'trace_slip',
            input: { task_code: 'MS-COMPLETE' },
            valid: true,
          },
          done('tool_use'),
        ],
        [
          { type: 'text-delta', text: 'Caused by #P03-A002-ENB-0110 and #NOT-A-CODE.' },
          done('end_turn'),
        ],
      ]),
    );
    expect(cited(answer)).toEqual(['P03-A002-ENB-0110']);
    expect(unverified(answer).map((part) => part.text)).toEqual(['NOT-A-CODE']);
  });

  it('answers a tool request whose input did not fit with an error, and runs nothing', async () => {
    const answer = await run(
      'Why?',
      playback([
        [
          {
            type: 'tool-request',
            toolUseId: 't1',
            name: 'trace_slip',
            input: { x: 1 },
            valid: false,
            problem: 'bad input',
          },
          done('tool_use'),
        ],
        [done('end_turn')],
      ]),
    );
    expect(answer.steps).toEqual([
      { tool: 'trace_slip', input: '1', result: 'bad input', isError: true },
    ]);
  });

  it('stops at the step limit', async () => {
    const answer = await run(
      'Loop',
      playback([
        [
          { type: 'tool-request', toolUseId: 't', name: 'diff_summary', input: {}, valid: true },
          done('tool_use'),
        ],
      ]),
    );
    expect(answer.status).toBe('error');
    expect(answer.error).toContain('all the steps');
  });

  it('reports an error from the assistant, and a stream that never finishes', async () => {
    const failed = await run(
      'Q',
      playback([[{ type: 'error', code: 'unavailable', message: 'Busy.', retryable: true }]]),
    );
    expect(failed).toMatchObject({ status: 'error', error: 'Busy.' });
    const cut = await run('Q', playback([[{ type: 'text-delta', text: 'Half' }]]));
    expect(cut.status).toBe('error');
  });

  it('stops when asked to', async () => {
    const controller = new AbortController();
    controller.abort();
    const answer = await ask({
      transport: scriptedTransport(),
      engine: loaded(),
      messages: [],
      question: SUGGESTED[1]!.text,
      signal: controller.signal,
      onUpdate: () => {},
    });
    expect(answer.status).toBe('stopped');
  });

  it('keeps the conversation for a follow-up question', async () => {
    const messages: Message[] = [];
    const engine = loaded();
    const transport = scriptedTransport();
    const signal = new AbortController().signal;
    await ask({
      transport,
      engine,
      messages,
      question: SUGGESTED[1]!.text,
      signal,
      onUpdate: () => {},
    });
    const second = await ask({
      transport,
      engine,
      messages,
      question: SUGGESTED[3]!.text,
      signal,
      onUpdate: () => {},
    });
    expect(second.steps.map((step) => step.tool)).toEqual(['search_activities']);
    expect(messages.filter((message) => typeof message.content === 'string')).toHaveLength(2);
  });
});

describe('the live transport', () => {
  const stream = (text: string[]) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of text) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    });

  it('reads events split across chunks, and skips lines that are not events', async () => {
    const events: AgentEvent[] = [];
    for await (const event of readEvents(
      stream([
        'data: {"type":"text-del',
        'ta","text":"Hi"}\n\n',
        'data: not json\n\n',
        'data: {"type":"other"}\n\n',
        `data: ${JSON.stringify(done('end_turn'))}\n\n`,
      ]),
    )) {
      events.push(event);
    }
    expect(events.map((event) => event.type)).toEqual(['text-delta', 'done']);
  });

  it('turns a refused or unreachable request into an error event', async () => {
    const refused = liveTransport(
      async () =>
        new Response('{"code":"rate-limited"}', {
          status: 429,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const unreachable = liveTransport(async () => {
      throw new TypeError('offline');
    });
    for (const transport of [refused, unreachable]) {
      const events: AgentEvent[] = [];
      for await (const event of transport.send([], new AbortController().signal))
        events.push(event);
      expect(events).toEqual([expect.objectContaining({ type: 'error', retryable: true })]);
    }
  });
});
