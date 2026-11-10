import { describe, expect, it } from 'vitest';
import {
  TOOL_DEFINITIONS,
  TOOL_INPUTS,
  TOOL_LIMITS,
  TOOL_NAMES,
  callsForCurrentQuestion,
  capResult,
  codesInResult,
  isToolResultTurn,
  parseToolCall,
  splitCitations,
} from '../src/index.ts';

describe('tool definitions', () => {
  it('define the same six tools in both forms, in a fixed order', () => {
    expect(TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      'search_activities',
      'get_activity',
      'trace_slip',
      'health_summary',
      'diff_summary',
      'propose_edit',
    ]);
    expect([...TOOL_NAMES].sort()).toEqual(TOOL_DEFINITIONS.map((tool) => tool.name).sort());
  });

  it('list the same properties in the JSON Schema as the validator accepts', () => {
    for (const tool of TOOL_DEFINITIONS) {
      const validatorKeys = Object.keys(TOOL_INPUTS[tool.name].shape).sort();
      expect(Object.keys(tool.input_schema.properties).sort(), tool.name).toEqual(validatorKeys);
      expect(tool.input_schema.additionalProperties).toBe(false);
      for (const required of tool.input_schema.required) expect(validatorKeys).toContain(required);
    }
  });

  it('serialise to the same bytes every time, so the prompt cache holds', () => {
    expect(JSON.stringify(TOOL_DEFINITIONS)).toBe(
      JSON.stringify(structuredClone(TOOL_DEFINITIONS)),
    );
    expect(JSON.stringify(TOOL_DEFINITIONS)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('parseToolCall', () => {
  it('accepts a good call', () => {
    expect(parseToolCall('get_activity', { task_code: 'A1000' })).toEqual({
      ok: true,
      name: 'get_activity',
      input: { task_code: 'A1000' },
    });
    expect(parseToolCall('diff_summary', {}).ok).toBe(true);
    expect(
      parseToolCall('search_activities', { changed_only: true, sort_by: 'finish_slip', limit: 10 })
        .ok,
    ).toBe(true);
  });

  it('refuses unknown tools, extra fields and values out of range', () => {
    const bad: [unknown, unknown][] = [
      ['delete_everything', {}],
      ['__proto__', {}],
      ['get_activity', {}],
      ['get_activity', { task_code: 'A1', extra: 1 }],
      ['get_activity', { task_code: 'x'.repeat(200) }],
      ['get_activity', null],
      ['search_activities', { limit: 5000 }],
      ['search_activities', { sort_by: 'password' }],
      ['health_summary', { update: 'next' }],
      [42, {}],
    ];
    for (const [name, input] of bad)
      expect(parseToolCall(name, input).ok, JSON.stringify([name, input])).toBe(false);
  });

  it('checks a proposed edit has what its kind of change needs', () => {
    const base = { task_code: 'A1', reason: 'To recover the slip on #A1.' };
    expect(
      parseToolCall('propose_edit', { ...base, change: 'set_original_duration', working_days: 12 })
        .ok,
    ).toBe(true);
    expect(parseToolCall('propose_edit', { ...base, change: 'set_original_duration' }).ok).toBe(
      false,
    );
    expect(
      parseToolCall('propose_edit', { ...base, change: 'set_constraint', constraint_type: 'none' })
        .ok,
    ).toBe(true);
    expect(
      parseToolCall('propose_edit', {
        ...base,
        change: 'set_constraint',
        constraint_type: 'start_on_or_after',
      }).ok,
    ).toBe(false);
    expect(
      parseToolCall('propose_edit', {
        ...base,
        change: 'set_constraint',
        constraint_type: 'start_on_or_after',
        constraint_date: '2026-03-02 08:00',
      }).ok,
    ).toBe(true);
    expect(
      parseToolCall('propose_edit', {
        ...base,
        change: 'set_constraint',
        constraint_type: 'start_on_or_after',
        constraint_date: 'next Monday',
      }).ok,
    ).toBe(false);
    expect(
      parseToolCall('propose_edit', { ...base, change: 'set_original_duration', working_days: -3 })
        .ok,
    ).toBe(false);
    expect(
      parseToolCall('propose_edit', {
        task_code: 'A1',
        change: 'set_original_duration',
        working_days: 3,
      }).ok,
    ).toBe(false);
  });
});

describe('capResult', () => {
  it('leaves a small result whole', () => {
    const { json, truncated, shown } = capResult([{ code: 'A1' }, { code: 'A2' }], {
      update: 'current',
    });
    expect(truncated).toBe(false);
    expect(shown).toBe(2);
    expect(JSON.parse(json)).toEqual({
      update: 'current',
      total: 2,
      shown: 2,
      rows: [{ code: 'A1' }, { code: 'A2' }],
    });
  });

  it('cuts to the row limit and says how many there were', () => {
    const rows = Array.from({ length: 400 }, (_, k) => ({ code: `A${k}` }));
    const result = JSON.parse(capResult(rows, {}, 12345).json);
    expect(result.rows).toHaveLength(TOOL_LIMITS.rows);
    expect(result).toMatchObject({ total: 12345, shown: 50, truncated: true });
  });

  it('cuts further when rows are large, and never exceeds the byte limit', () => {
    const rows = Array.from({ length: 50 }, (_, k) => ({ code: `A${k}`, name: 'x'.repeat(600) }));
    const { json, shown, truncated } = capResult(rows);
    expect(new TextEncoder().encode(json).length).toBeLessThanOrEqual(TOOL_LIMITS.bytes);
    expect(shown).toBeLessThan(50);
    expect(shown).toBeGreaterThan(0);
    expect(truncated).toBe(true);
    expect(capResult([{ name: 'x'.repeat(20000) }]).shown).toBe(0);
  });
});

describe('counting calls for a question', () => {
  const question = { role: 'user', content: 'Why did completion slip?' };
  const call = {
    role: 'assistant',
    content: [{ type: 'tool_use', id: 't1', name: 'diff_summary', input: {} }],
  };
  const results = {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 't1', content: '{}' }],
  };

  it('tells a tool result turn from a question', () => {
    expect(isToolResultTurn(results)).toBe(true);
    expect(isToolResultTurn(question)).toBe(false);
    expect(isToolResultTurn({ role: 'user', content: [{ type: 'text', text: 'hi' }] })).toBe(false);
    expect(isToolResultTurn({ role: 'user', content: [] })).toBe(false);
    expect(isToolResultTurn({ role: 'assistant', content: [{ type: 'tool_result' }] })).toBe(false);
  });

  it('counts model answers since the latest question only', () => {
    expect(callsForCurrentQuestion([question])).toBe(0);
    expect(callsForCurrentQuestion([question, call, results])).toBe(1);
    expect(callsForCurrentQuestion([question, call, results, call, results])).toBe(2);
    const earlier = [question, call, results, { role: 'assistant', content: 'Because of #A1.' }];
    expect(callsForCurrentQuestion([...earlier, question])).toBe(0);
    expect(callsForCurrentQuestion([...earlier, question, call, results])).toBe(1);
  });
});

describe('citations', () => {
  const known = new Set(['MS-COMPLETE', 'P02-A003-TRK-0040', 'A1.5']);

  it('marks codes seen in tool results as verified and others as unverified', () => {
    expect(
      splitCitations(
        'Completion #MS-COMPLETE slipped because of #P02-A003-TRK-0040 and #MADE-UP.',
        known,
      ),
    ).toEqual([
      { kind: 'text', text: 'Completion ' },
      { kind: 'verified', text: 'MS-COMPLETE' },
      { kind: 'text', text: ' slipped because of ' },
      { kind: 'verified', text: 'P02-A003-TRK-0040' },
      { kind: 'text', text: ' and ' },
      { kind: 'unverified', text: 'MADE-UP' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('does not swallow the full stop after a code, and keeps one that belongs to it', () => {
    expect(splitCitations('See #MS-COMPLETE.', known).map((part) => part.text)).toEqual([
      'See ',
      'MS-COMPLETE',
      '.',
    ]);
    expect(splitCitations('See #A1.5.', known).map((part) => part.text)).toEqual([
      'See ',
      'A1.5',
      '.',
    ]);
  });

  it('puts the text back together exactly', () => {
    const text = 'No codes here. #MS-COMPLETE, then (#X-1) and a lone # sign.';
    expect(
      splitCitations(text, known)
        .map((part) => (part.kind === 'text' ? part.text : `#${part.text}`))
        .join(''),
    ).toBe(text);
    expect(splitCitations('', known)).toEqual([]);
  });

  it('collects codes from a tool result by key, not from free text', () => {
    const result = {
      total: 2,
      rows: [
        {
          code: 'A1',
          name: 'Mentions #SNEAKY and Z9 in its name',
          predecessors: [{ task_code: 'B2', type: 'FS' }],
        },
        { task_code: 'C3', driving_predecessor: 'D4', successor: 'E5' },
      ],
    };
    expect([...codesInResult(result)].sort()).toEqual(['A1', 'B2', 'C3', 'D4', 'E5']);
  });
});
