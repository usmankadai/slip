/**
 * The tools the agent can call. The model never sees the schedule: it sees
 * these six tools and whatever they return. They run in the browser against
 * the engine worker; the server only passes the requests along.
 *
 * Each tool has two descriptions of its input that must agree: a JSON Schema
 * the model reads, written out by hand so its bytes never change (it is part
 * of the cached prompt), and a zod schema that checks what the model sent.
 * A test keeps them in step.
 */
import { z } from 'zod';

/** Limits on what a tool may send back to the model. */
export const TOOL_LIMITS = {
  /** Most rows in one result. */
  rows: 50,
  /** Most bytes of JSON in one result. */
  bytes: 8 * 1024,
} as const;

const taskCode = z.string().min(1).max(80);

export const CHANGE_KINDS = [
  'added',
  'start_moved',
  'finish_moved',
  'duration_changed',
  'progressed',
  'constraint_changed',
  'logic_changed',
  'float_changed',
  'joined_critical_path',
  'left_critical_path',
] as const;

export const CONSTRAINT_TYPES = [
  'none',
  'start_on',
  'start_on_or_after',
  'start_on_or_before',
  'finish_on',
  'finish_on_or_after',
  'finish_on_or_before',
] as const;

export const TOOL_INPUTS = {
  search_activities: z.strictObject({
    query: z.string().max(100).optional(),
    changed_only: z.boolean().optional(),
    change_kinds: z.array(z.enum(CHANGE_KINDS)).max(CHANGE_KINDS.length).optional(),
    critical_only: z.boolean().optional(),
    status: z
      .array(z.enum(['not_started', 'in_progress', 'complete']))
      .max(3)
      .optional(),
    sort_by: z.enum(['finish_slip', 'total_float', 'start', 'finish', 'code']).optional(),
    limit: z.number().int().min(1).max(TOOL_LIMITS.rows).optional(),
  }),
  get_activity: z.strictObject({ task_code: taskCode }),
  trace_slip: z.strictObject({ task_code: taskCode }),
  health_summary: z.strictObject({ update: z.enum(['previous', 'current']) }),
  diff_summary: z.strictObject({}),
  propose_edit: z.strictObject({
    task_code: taskCode,
    change: z.enum(['set_original_duration', 'set_remaining_duration', 'set_constraint']),
    working_days: z.number().min(0).max(5000).optional(),
    constraint_type: z.enum(CONSTRAINT_TYPES).optional(),
    /** "YYYY-MM-DD HH:MM", wall-clock, as dates appear in tool results. */
    constraint_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
      .optional(),
    reason: z.string().min(1).max(300),
  }),
} as const;

export type ToolName = keyof typeof TOOL_INPUTS;
export type ToolInput<T extends ToolName> = z.infer<(typeof TOOL_INPUTS)[T]>;

export const TOOL_NAMES = Object.keys(TOOL_INPUTS) as ToolName[];
export const isToolName = (name: unknown): name is ToolName =>
  typeof name === 'string' && Object.hasOwn(TOOL_INPUTS, name);

export interface ToolDefinition {
  name: ToolName;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
}

const code = {
  type: 'string',
  description:
    'Activity code exactly as it appears in a tool result, for example "P02-A003-TRK-0040".',
};

/** In a fixed order, with fixed wording: any change here changes the cached prompt. */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_activities',
    description:
      'Find activities in the current update. Every filter is optional and they combine. Returns at most 50 rows with code, name, status, start, finish, finish slip against the previous update, total float and what changed. The result says how many activities matched in total, so narrow the filters if it was cut short.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to find in the activity code or name.' },
        changed_only: {
          type: 'boolean',
          description: 'Only activities that changed since the previous update.',
        },
        change_kinds: {
          type: 'array',
          items: { type: 'string', enum: [...CHANGE_KINDS] },
          description: 'Only activities with at least one of these kinds of change.',
        },
        critical_only: {
          type: 'boolean',
          description: 'Only unfinished activities with total float of zero or less.',
        },
        status: {
          type: 'array',
          items: { type: 'string', enum: ['not_started', 'in_progress', 'complete'] },
        },
        sort_by: {
          type: 'string',
          enum: ['finish_slip', 'total_float', 'start', 'finish', 'code'],
          description:
            'finish_slip puts the largest slip first; total_float puts the least float first.',
        },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_activity',
    description:
      'Everything about one activity in both updates: dates, durations, float, constraint, status, its predecessors and successors, and what changed between the updates.',
    input_schema: {
      type: 'object',
      properties: { task_code: code },
      required: ['task_code'],
      additionalProperties: false,
    },
  },
  {
    name: 'trace_slip',
    description:
      'Explain why an activity\'s finish moved between the two updates. Walks back through the activities that drive its date and returns the ones that added delay of their own, largest first, with the kind of cause (duration, progress, logic, constraint, added work) and the working days each added. Use this for any "why did this slip" question.',
    input_schema: {
      type: 'object',
      properties: { task_code: code },
      required: ['task_code'],
      additionalProperties: false,
    },
  },
  {
    name: 'health_summary',
    description:
      "The DCMA 14-point schedule quality checks for one update: each check's value, threshold, and whether it passes. Call it for both updates to compare them.",
    input_schema: {
      type: 'object',
      properties: { update: { type: 'string', enum: ['previous', 'current'] } },
      required: ['update'],
      additionalProperties: false,
    },
  },
  {
    name: 'diff_summary',
    description:
      'Counts of what changed between the previous and current update: activities added and removed, and how many had dates, durations, logic, constraints, progress or float change, plus the key milestones that moved.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'propose_edit',
    description:
      'Propose one change to an activity in the current update. This does not change the schedule: the planner sees the proposal with its effect on key dates and decides whether to apply it. The result reports that effect so you can describe it. Give working_days for a duration change, or constraint_type (and constraint_date unless the type is "none") for a constraint change.',
    input_schema: {
      type: 'object',
      properties: {
        task_code: code,
        change: {
          type: 'string',
          enum: ['set_original_duration', 'set_remaining_duration', 'set_constraint'],
        },
        working_days: {
          type: 'number',
          minimum: 0,
          maximum: 5000,
          description: "New duration in working days of the activity's own calendar.",
        },
        constraint_type: { type: 'string', enum: [...CONSTRAINT_TYPES] },
        constraint_date: {
          type: 'string',
          description: 'Wall-clock date and time as "YYYY-MM-DD HH:MM".',
        },
        reason: {
          type: 'string',
          description:
            'One sentence the planner will read: why this change, citing activity codes.',
        },
      },
      required: ['task_code', 'change', 'reason'],
      additionalProperties: false,
    },
  },
];

export type ParsedToolCall =
  { ok: true; name: ToolName; input: unknown } | { ok: false; problem: string };

/**
 * Checks a tool call the model made. Model output is untrusted: an unknown
 * tool, extra fields or values out of range are refused before anything runs.
 */
export function parseToolCall(name: unknown, input: unknown): ParsedToolCall {
  if (!isToolName(name)) return { ok: false, problem: 'There is no tool with that name.' };
  const result = TOOL_INPUTS[name].safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue && issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return {
      ok: false,
      problem: `The input does not fit the tool: ${where}${issue?.message ?? 'invalid'}`,
    };
  }
  if (name === 'propose_edit') {
    const edit = result.data as ToolInput<'propose_edit'>;
    if (edit.change === 'set_constraint') {
      if (edit.constraint_type === undefined)
        return { ok: false, problem: 'set_constraint needs constraint_type.' };
      if (edit.constraint_type !== 'none' && edit.constraint_date === undefined) {
        return { ok: false, problem: 'That constraint type needs constraint_date.' };
      }
    } else if (edit.working_days === undefined) {
      return { ok: false, problem: 'A duration change needs working_days.' };
    }
  }
  return { ok: true, name, input: result.data };
}

/**
 * Fits a tool result to the limits. `rows` is cut to the row limit and then
 * further until the JSON fits the byte limit; the result always says how
 * many rows there were, so the model can narrow its query instead of guessing.
 */
export function capResult<Row>(
  rows: Row[],
  extra: Record<string, unknown> = {},
  total = rows.length,
): { json: string; shown: number; truncated: boolean } {
  let shown = Math.min(rows.length, TOOL_LIMITS.rows);
  const encoder = new TextEncoder();
  for (;;) {
    const truncated = shown < total;
    const json = JSON.stringify({
      ...extra,
      total,
      shown,
      ...(truncated
        ? { truncated: true, note: 'Only some rows are shown. Narrow the request to see others.' }
        : {}),
      rows: rows.slice(0, shown),
    });
    if (encoder.encode(json).length <= TOOL_LIMITS.bytes || shown === 0)
      return { json, shown, truncated };
    shown = Math.floor(shown * 0.8);
  }
}
