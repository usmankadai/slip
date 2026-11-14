/**
 * Scripted answers: the public default, so the link always has a working
 * assistant that costs nothing (D11). Each suggested question has a script
 * that asks for the real tools, reads their real results from the
 * conversation, and fills a template. The prose is canned; every figure and
 * every cited activity comes from the tool results for the loaded schedule.
 */
import type { AgentEvent } from '@slip/agent';
import { callsForCurrentQuestion } from '@slip/agent';
import type { AgentTransport, Message } from './transport.ts';

export interface SuggestedQuestion {
  id: string;
  text: string;
}

export const SUGGESTED: SuggestedQuestion[] = [
  { id: 'largest', text: 'Why did the milestone that slipped most move?' },
  { id: 'changed', text: 'What changed between the two updates?' },
  { id: 'health', text: 'Which health checks got worse?' },
  { id: 'critical', text: 'Which critical activities slipped most?' },
];

interface ToolCall {
  name: string;
  input: unknown;
}
interface ToolResult extends ToolCall {
  output: Record<string, unknown> | null;
  isError: boolean;
}
type Step = { tools: ToolCall[] } | { answer: string };
type Script = (results: ToolResult[]) => Step;

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);
const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const days = (value: number) =>
  `${Math.abs(value).toLocaleString('en-GB', { maximumFractionDigits: 1 })} working ${Math.abs(value) === 1 ? 'day' : 'days'}`;
const signed = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('en-GB', { maximumFractionDigits: 1 })}d`;
/** "2027-08-10 17:00" to "10 August 2027". Text only: no date object is made. */
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const words = (value: unknown): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(value));
  return match ? `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : 'no date';
};
const list = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const CAUSE: Record<string, string> = {
  duration: 'duration grew',
  progress: 'taking longer',
  logic: 'logic changed',
  constraint: 'held by a constraint',
  added: 'new activity',
  'driver-changed': 'became the driver',
};
const failure = (results: ToolResult[]) =>
  results.find((result) => result.isError || !result.output);
const COULD_NOT = 'The tools could not answer this for the loaded updates.';

const SCRIPTS: Record<string, Script> = {
  largest(results) {
    if (results.length === 0) return { tools: [{ name: 'diff_summary', input: {} }] };
    if (failure(results)) return { answer: COULD_NOT };
    const diff = results[0]!.output!;
    const top = rows(diff.milestones_moved).find((row) => (num(row.slip_working_days) ?? 0) > 0);
    if (!top) {
      return {
        answer:
          'No milestone finishes later than it did in the last update, so there is no slip to explain.',
      };
    }
    if (results.length === 1)
      return { tools: [{ name: 'trace_slip', input: { task_code: str(top.code) } }] };
    const trace = results[1]!.output!;
    const added = rows(trace.contributors)
      .filter((row) => (num(row.working_days) ?? 0) > 0)
      .slice(0, 3);
    const recovered = rows(trace.contributors)
      .filter((row) => (num(row.working_days) ?? 0) < 0)
      .slice(0, 1);
    const sentences = [
      `${str(top.name)} #${str(top.code)} moved ${days(num(top.slip_working_days)!)} later, from ${words(top.previous_finish)} to ${words(top.current_finish)}.`,
    ];
    if (added.length > 0) {
      sentences.push(
        `${rows(trace.contributors).filter((row) => (num(row.working_days) ?? 0) > 0).length} activities on its driving path added time of their own. The largest ${added.length === 1 ? 'was' : 'were'} ${list(
          added.map(
            (row) =>
              `${str(row.name)} #${str(row.code)} (${CAUSE[str(row.cause)] ? `${CAUSE[str(row.cause)]}, ` : ''}${signed(num(row.working_days)!)})`,
          ),
        )}.`,
      );
    } else {
      sentences.push(
        'No activity on its driving path added time of its own, so the slip came from further back than the trace reaches.',
      );
    }
    for (const row of recovered)
      sentences.push(
        `${str(row.name)} #${str(row.code)} recovered ${days(num(row.working_days)!)}.`,
      );
    return { answer: sentences.join(' ') };
  },

  changed(results) {
    if (results.length === 0) return { tools: [{ name: 'diff_summary', input: {} }] };
    if (failure(results)) return { answer: COULD_NOT };
    const diff = results[0]!.output!;
    const kinds = (diff.by_kind_of_change ?? {}) as Record<string, unknown>;
    const n = (key: string) => num(kinds[key]) ?? 0;
    const parts = [
      [n('finish_moved'), 'had their finish move'],
      [n('duration_changed'), 'changed duration'],
      [n('logic_changed'), 'had logic changes'],
      [n('progressed'), 'progressed'],
    ]
      .filter(([count]) => (count as number) > 0)
      .map(([count, what]) => `${(count as number).toLocaleString('en-GB')} ${what}`);
    const sentences = [
      `${(num(diff.activities_changed) ?? 0).toLocaleString('en-GB')} activities changed between the two updates.`,
    ];
    if (parts.length > 0) sentences.push(`Of those, ${list(parts)}.`);
    if (n('added') || n('removed'))
      sentences.push(
        `${n('added').toLocaleString('en-GB')} were added and ${n('removed').toLocaleString('en-GB')} removed.`,
      );
    const moved = rows(diff.milestones_moved).slice(0, 3);
    if (moved.length > 0) {
      sentences.push(
        `${(num(diff.milestones_moved_total) ?? moved.length).toLocaleString('en-GB')} milestones moved; the largest ${moved.length === 1 ? 'was' : 'were'} ${list(
          moved.map(
            (row) =>
              `${str(row.name)} #${str(row.code)} (${signed(num(row.slip_working_days) ?? 0)})`,
          ),
        )}.`,
      );
    } else {
      sentences.push('No milestone moved.');
    }
    return { answer: sentences.join(' ') };
  },

  health(results) {
    if (results.length === 0) {
      return {
        tools: [
          { name: 'health_summary', input: { update: 'previous' } },
          { name: 'health_summary', input: { update: 'current' } },
        ],
      };
    }
    if (failure(results)) return { answer: COULD_NOT };
    const before = new Map(rows(results[0]!.output!.checks).map((row) => [num(row.id), row]));
    const worse: string[] = [];
    let failing = 0;
    for (const now of rows(results[1]!.output!.checks)) {
      if (now.passes === false) failing++;
      const was = before.get(num(now.id));
      if (!was || was.passes === null || now.passes === null || now.passes === undefined) continue;
      const atLeast = str(now.passes_when).includes('at or above');
      const a = num(was.value);
      const b = num(now.value);
      const further = a !== null && b !== null && (atLeast ? b < a : b > a);
      // One decimal place, or two when one would make a real change look like none.
      const places = a !== null && b !== null && a !== b && a.toFixed(1) === b.toFixed(1) ? 2 : 1;
      const shown = (value: number | null) =>
        value === null
          ? 'not assessed'
          : now.unit === 'percent'
            ? `${value.toFixed(places)}%`
            : now.unit === 'ratio'
              ? value.toFixed(2)
              : value.toLocaleString('en-GB');
      if ((was.passes && !now.passes) || (!was.passes && !now.passes && further)) {
        worse.push(`${str(now.name)} (${shown(a)} to ${shown(b)})`);
      }
    }
    return {
      answer:
        worse.length === 0
          ? `No DCMA check got worse. ${failing} fail in the current update.`
          : `${worse.length} DCMA ${worse.length === 1 ? 'check' : 'checks'} got worse: ${list(worse)}. ${failing} fail in the current update.`,
    };
  },

  critical(results) {
    if (results.length === 0) {
      return {
        tools: [
          {
            name: 'search_activities',
            input: { critical_only: true, changed_only: true, sort_by: 'finish_slip', limit: 5 },
          },
        ],
      };
    }
    if (failure(results)) return { answer: COULD_NOT };
    const found = rows(results[0]!.output!.rows).filter(
      (row) => (num(row.finish_slip_days) ?? 0) > 0,
    );
    if (found.length === 0)
      return { answer: 'No critical activity finishes later than it did in the last update.' };
    return {
      answer: `The critical activities that slipped most are ${list(
        found.map(
          (row) =>
            `${str(row.name)} #${str(row.code)} (${signed(num(row.finish_slip_days)!)}, now finishing ${words(row.finish)})`,
        ),
      )}.`,
    };
  },
};

const UNKNOWN =
  'The scripted assistant answers only the suggested questions. It does not read free questions: that needs the live assistant, which is off on this site.';

/** The question's text, and the tool calls and results since it was asked. */
function readConversation(messages: readonly Message[]): {
  question: string;
  results: ToolResult[];
} {
  let at = messages.length - 1;
  while (at >= 0 && !(messages[at]!.role === 'user' && typeof messages[at]!.content === 'string'))
    at--;
  const question = at >= 0 ? String(messages[at]!.content) : '';
  const calls = new Map<string, ToolCall>();
  const results: ToolResult[] = [];
  for (const message of messages.slice(at + 1)) {
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content as Record<string, unknown>[]) {
      if (block.type === 'tool_use')
        calls.set(String(block.id), { name: String(block.name), input: block.input });
      if (block.type === 'tool_result') {
        const call = calls.get(String(block.tool_use_id));
        let output: Record<string, unknown> | null;
        try {
          output = JSON.parse(String(block.content)) as Record<string, unknown>;
        } catch {
          output = null;
        }
        results.push({
          name: call?.name ?? '',
          input: call?.input,
          output,
          isError: block.is_error === true,
        });
      }
    }
  }
  return { question, results };
}

const normalise = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

export function scriptedTransport(): AgentTransport {
  let next = 1;
  return {
    scripted: true,
    async *send(messages): AsyncIterable<AgentEvent> {
      const { question, results } = readConversation(messages);
      const match = SUGGESTED.find((item) => normalise(item.text) === normalise(question));
      const step: Step = match ? SCRIPTS[match.id]!(results) : { answer: UNKNOWN };
      const callsUsed = callsForCurrentQuestion(messages) + 1;
      if ('tools' in step) {
        const blocks = step.tools.map((tool) => ({
          type: 'tool_use',
          id: `scripted-${next++}`,
          name: tool.name,
          input: tool.input,
        }));
        for (const block of blocks) {
          yield {
            type: 'tool-request',
            toolUseId: block.id,
            name: block.name,
            input: block.input,
            valid: true,
          };
        }
        yield {
          type: 'done',
          stopReason: 'tool_use',
          assistant: blocks,
          callsUsed,
          callsAllowed: 8,
        };
        return;
      }
      // Sent a sentence at a time, the way a live answer arrives.
      for (const sentence of step.answer.match(/[^.]+\.?\s*/g) ?? [step.answer]) {
        yield { type: 'text-delta', text: sentence };
      }
      yield {
        type: 'done',
        stopReason: 'end_turn',
        assistant: [{ type: 'text', text: step.answer }],
        callsUsed,
        callsAllowed: 8,
      };
    },
  };
}
