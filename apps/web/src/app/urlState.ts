/**
 * The view a planner would want to share or come back to, in the address bar.
 *
 * `?a=<id>&b=<id>&s=<screen>&c=<changes>&q=<text>&check=<n>&t=<code>`
 *
 * - `a`, `b`: the two updates, as the first 12 characters of the file's hash and the project read
 *   from it (`3f9c0a1b2c3d-p12`). Never a file name: names can carry a client's name.
 * - `s`: the screen underneath: `health`, `finish` or `log`. Absent for the summary.
 * - `c`: the changes grid is open, on this kind of change (`everything` for every activity).
 * - `q`: the activity code the grid was opened on, from the narrative's evidence or the assistant.
 *   Text the planner types into the grid's search is never written: it could be part of a name.
 * - `check`: a health check whose activities the grid shows.
 * - `sel`: the activity selected in the grid, by its task code. The drawer shows it.
 * - `t`: the activity whose slip is traced, by its task code.
 *
 * Only task codes and Slip's own words go in the URL, never activity names or other schedule
 * content (security spec). Everything read back is checked; anything unexpected is dropped.
 */
import type { ChangeKind } from '../features/changes/model.ts';

export type Underneath = 'summary' | 'health' | 'finish' | 'log';

export interface UrlView {
  underneath: Underneath;
  /** `text` is an activity code the grid opened on, never typed search text. */
  changes: { kind: ChangeKind | null; text?: string; check?: number; sel?: string } | null;
  trace: string | null;
}

export interface UrlState {
  /** The two updates, or null when no pair is named. */
  pair: { a: string; b: string } | null;
  view: UrlView;
}

export const HOME_VIEW: UrlView = { underneath: 'summary', changes: null, trace: null };

const KINDS: readonly ChangeKind[] = [
  'all',
  'dates',
  'durations',
  'logic',
  'constraints',
  'progress',
  'added',
];
const UNDERNEATH: readonly Underneath[] = ['health', 'finish', 'log'];
const ID = /^[0-9a-f]{12}-p\d{1,9}$/;
/** P6 task codes are at most 40 characters; allow a little room, and nothing that is not printable. */
const CODE = /^[\x20-\x7e]{1,60}$/;

/** The id of one update in a URL: its file's hash, shortened, and its project. */
export function updateId(facts: { sourceHash: string; projectId: number }): string {
  return `${facts.sourceHash.slice(0, 12)}-p${facts.projectId}`;
}

export function readUrl(search: string): UrlState {
  const params = new URLSearchParams(search);
  const a = params.get('a');
  const b = params.get('b');
  const pair = a && b && ID.test(a) && ID.test(b) ? { a, b } : null;

  const s = params.get('s');
  const underneath = UNDERNEATH.includes(s as Underneath) ? (s as Underneath) : 'summary';

  const c = params.get('c');
  let changes: UrlView['changes'] = null;
  if (c === 'everything' || KINDS.includes(c as ChangeKind)) {
    changes = { kind: c === 'everything' ? null : (c as ChangeKind) };
    const code = params.get('q');
    if (code && CODE.test(code)) changes.text = code;
    const check = Number(params.get('check'));
    if (Number.isInteger(check) && check >= 1 && check <= 14) changes.check = check;
    const sel = params.get('sel');
    if (sel && CODE.test(sel)) changes.sel = sel;
  }

  const t = params.get('t');
  const trace = t && CODE.test(t) ? t : null;

  // A view without a pair means nothing: the screens all need the two updates.
  return { pair, view: pair ? { underneath, changes, trace } : HOME_VIEW };
}

/** The search part of the URL for a state: `?a=...`, or '' for the import screen. */
export function writeUrl(state: UrlState): string {
  if (!state.pair) return '';
  const params = new URLSearchParams();
  params.set('a', state.pair.a);
  params.set('b', state.pair.b);
  const { underneath, changes, trace } = state.view;
  if (underneath !== 'summary') params.set('s', underneath);
  if (changes) {
    params.set('c', changes.kind ?? 'everything');
    if (changes.text && CODE.test(changes.text)) params.set('q', changes.text);
    if (changes.check) params.set('check', String(changes.check));
    if (changes.sel && CODE.test(changes.sel)) params.set('sel', changes.sel);
  }
  if (trace && CODE.test(trace)) params.set('t', trace);
  return `?${params.toString()}`;
}

/** Whether a URL names this pair. */
export function namesPair(
  url: UrlState,
  pair: {
    a: { sourceHash: string; projectId: number };
    b: { sourceHash: string; projectId: number };
  },
): boolean {
  return url.pair !== null && url.pair.a === updateId(pair.a) && url.pair.b === updateId(pair.b);
}

/**
 * Whether two views show the same screen, differing only in what the changes grid filters by or
 * which activity is selected.
 * Moving between those replaces the browser's history entry instead of adding one.
 */
export function sameScreen(a: UrlView, b: UrlView): boolean {
  return (
    a.underneath === b.underneath &&
    (a.changes === null) === (b.changes === null) &&
    a.trace === b.trace
  );
}
