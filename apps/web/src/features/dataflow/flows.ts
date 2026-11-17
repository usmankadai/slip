/**
 * What leaves the browser, in one place. The in-app panel draws this table, and a test checks that
 * docs/data-flow.md and docs/spec/security.md print exactly the same rows. Change all three together.
 */

export type AssistantMode = 'scripted' | 'live';

/** Dispatch this event on window to open "Where your data goes" from anywhere in the app. */
export const OPEN_DATA_FLOW = 'slip:open-data-flow';

export interface Flow {
  data: string;
  stays: string;
  server: string;
  anthropic: string;
  /** Applies only when the assistant is live. */
  liveOnly?: boolean;
}

export const FLOW_HEADINGS = [
  'Data',
  'Stays in this browser',
  "Sent to Slip's server",
  'Sent to Anthropic',
] as const;

export const FLOWS: readonly Flow[] = [
  { data: 'XER files and parsed schedules', stays: 'Yes', server: 'Never', anthropic: 'Never' },
  {
    data: 'Edits, the activity log and the narrative',
    stays: 'Yes',
    server: 'Never',
    anthropic: 'Never',
  },
  {
    data: 'Questions to the assistant, live mode',
    stays: 'Yes',
    server: 'In transit, not stored',
    anthropic: 'Yes',
    liveOnly: true,
  },
  {
    data: 'Rows the assistant asks for, live mode: activity codes and dates, and names unless you turn them off',
    stays: 'Yes',
    server: 'In transit, not stored',
    anthropic: 'Yes',
    liveOnly: true,
  },
  { data: 'Anything, scripted mode', stays: 'Yes', server: 'Never', anthropic: 'Never' },
  {
    data: "The page address: the two files' short ids and at most three activity codes",
    stays: 'Yes',
    server: 'With each page load, as for any website; not stored by Slip',
    anthropic: 'Never',
  },
  { data: 'Error reports', stays: 'Not collected yet', server: 'Never', anthropic: 'Never' },
];

/** The rows as plain cells, headings first, for comparing with a Markdown table. */
export function flowCells(): string[][] {
  return [
    [...FLOW_HEADINGS],
    ...FLOWS.map((flow) => [flow.data, flow.stays, flow.server, flow.anthropic]),
  ];
}

/** The cells of the first Markdown table after a heading, with the separator row left out. */
export function markdownTableAfter(markdown: string, heading: string): string[][] | null {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith('#') && line.includes(heading));
  if (start < 0) return null;
  const rows: string[][] = [];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      if (rows.length > 0) break;
      continue;
    }
    const cells = trimmed
      .slice(1, trimmed.endsWith('|') ? -1 : undefined)
      .split('|')
      .map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows.length > 0 ? rows : null;
}

/** The one sentence the panel leads with. */
export function leadSentence(mode: AssistantMode): string {
  return mode === 'live'
    ? "Your files are never uploaded. When you ask the live assistant a question, the question and the rows it needs to answer it are sent through Slip's server to Anthropic. Nothing is stored on the way."
    : "Nothing about your schedule leaves this browser. The files are read here and kept in this browser's storage. The assistant is scripted: its answers are prepared in advance and run here.";
}
