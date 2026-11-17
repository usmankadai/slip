/**
 * The design explorations, for the "Design process" pages in Storybook. Each one summarises the
 * README beside its drawing in docs/design; the README is the record and wins if they differ.
 */

/** Whose reasons the decision rests on. */
export type Decided =
  /** Usman chose, and the reasons recorded are his. */
  | 'own'
  /** Usman chose an option, without giving reasons; the reasons recorded are Claude's. */
  | 'chose'
  /** Usman accepted Claude's recommendation; the reasons recorded are Claude's. */
  | 'accepted';

export interface Option {
  letter: string;
  name: string;
  /** One line: what it does well, then what it does badly. */
  summary: string;
}

export interface Exploration {
  /** Story name and path segment, such as "01". */
  number: string;
  title: string;
  /** Folder under docs/design/explorations. */
  folder: string;
  /** The drawing, relative to the folder. */
  page: string;
  date: string;
  problem: string;
  options: Option[];
  /** Letters of the options taken, in full or in part. */
  chosen: string[];
  decision: string;
  decided: Decided;
  /** Usman's words when he chose, if recorded. */
  quote?: string;
  why: string[];
  /** Stories that show what was built from it. */
  built: { label: string; story: string }[];
}

export const EXPLORATIONS: Exploration[] = [
  {
    number: '01',
    title: 'Slip in a grid cell',
    folder: '01-slip-in-a-grid-cell',
    page: 'options.html',
    date: '11 November 2026',
    problem:
      'The one column that matters most in the changes grid: how far each finish moved. It has to carry sign, size and direction in a 24px row, without colour alone, and without turning a grid where most rows changed into a wall of colour.',
    options: [
      {
        letter: 'A',
        name: 'Signed number',
        summary: 'Narrowest and plain; but nothing to scan, every value must be read.',
      },
      {
        letter: 'B',
        name: 'Number and diverging bar',
        summary:
          'The worst rows are found by eye, and direction is position; but about 170px wide.',
      },
      {
        letter: 'C',
        name: 'Stepped heat cell',
        summary:
          'The strongest scan at no extra width; but fills the grid with colour and leans on it hardest.',
      },
      {
        letter: 'D',
        name: 'Direction glyph and number',
        summary:
          'Shape carries direction; but five sizes of a small triangle are hard to tell apart.',
      },
    ],
    chosen: ['B'],
    decision:
      'B, number and diverging bar, on a fixed square root scale that is full length at 40 working days.',
    decided: 'accepted',
    quote: 'use your recommendation',
    why: [
      'Finding the worst movers by eye is the job of the column, and B is the only option that does it by position, which survives greyscale and every colour-blind view.',
      'Slip is the subject of the product, so this can be its widest numeric column.',
    ],
    built: [{ label: 'DeltaCell', story: 'components-deltacell--later' }],
  },
  {
    number: '02',
    title: 'Two schedules on one Gantt',
    folder: '02-two-schedules-on-one-gantt',
    page: 'options.html',
    date: '11 November 2026',
    problem:
      'The Gantt shows this update and the previous one on the same rows. A second bar for every activity doubles the ink where most bars did not move, and the treatment must keep a one-day move visible at month zoom, cope with bars off the edge and new activities, and not rest on colour.',
    options: [
      {
        letter: 'A',
        name: 'A thin bar underneath',
        summary:
          'The baseline bar every P6 user knows; but doubles the marks on activities that did not move.',
      },
      {
        letter: 'B',
        name: 'An outline behind',
        summary:
          'Nothing extra where nothing moved; but the outline reads as an empty second activity.',
      },
      {
        letter: 'C',
        name: 'Only the difference',
        summary:
          'The least ink, all of it meaningful, and a one-day move stays visible; but the old dates are not shown for every row.',
      },
    ],
    chosen: ['C'],
    decision:
      'C, only the difference, with the previous bar drawn in full for the selected activity.',
    decided: 'accepted',
    quote: 'C, your pick',
    why: [
      'Colour appears only where a date moved, and a warm mark always means late.',
      'It is the only option that keeps a one-day move visible at month zoom; the selected row gives the exact previous dates on demand.',
    ],
    built: [{ label: 'Changes grid with the Gantt', story: 'screens-changes-grid--with-gantt' }],
  },
  {
    number: '03',
    title: 'The trace view',
    folder: '03-trace-view',
    page: 'options.html',
    date: '12 November 2026',
    problem:
      'Why did a milestone move? The driving path can be dozens of activities long and the cause is usually a handful. The view has to keep the answer apart from the evidence, show slip an activity added apart from slip it passed on, and cope with recoveries and a long tail of small causes.',
    options: [
      {
        letter: 'A',
        name: 'Ranked causes, the chain folded away',
        summary: 'It is the answer, largest first; but the path that connects them is hidden.',
      },
      {
        letter: 'B',
        name: 'The driving path, own and inherited slip on each',
        summary: 'Shows both on every activity; but long, and the causes must be found in it.',
      },
      {
        letter: 'C',
        name: 'A waterfall of contributions',
        summary:
          'The pieces visibly make the whole; but cannot be both largest first and in path order.',
      },
    ],
    chosen: ['A', 'B'],
    decision: 'A leading, with B beneath it as the evidence, opened on request.',
    decided: 'accepted',
    quote: 'A with B beneath',
    why: [
      'It is the hierarchy the spec asks for: the answer first in rank order, then the path for anyone who wants to check it.',
      "C's idea survives in B, where each activity's bar starts from the slip it inherited.",
    ],
    built: [{ label: 'Slip trace', story: 'screens-slip-trace--populated' }],
  },
  {
    number: '04',
    title: 'The proposed edit card',
    folder: '04-proposed-edit-card',
    page: 'options.html',
    date: '14 November 2026',
    problem:
      "The assistant can propose a change but never make it. The card must give enough of the engine's preview to approve with confidence, without becoming a form, and a change that makes things worse must not look like one that helps.",
    options: [
      {
        letter: 'A',
        name: 'One sentence of effect',
        summary:
          'Reads in seconds; but a change that helps one milestone and hurts another is hidden.',
      },
      {
        letter: 'B',
        name: 'The milestones it moves, as a small table',
        summary: 'Every milestone it moves, with its slip; but larger.',
      },
      {
        letter: 'C',
        name: 'Editable before approving',
        summary:
          "The planner can adjust the idea; but it becomes a form, and the assistant's proposal is lost.",
      },
    ],
    chosen: ['B'],
    decision: 'B, the milestones it moves, as a small table.',
    decided: 'accepted',
    quote: 'B, milestone table',
    why: [
      'Milestones are what a planner is accountable for.',
      'B is the only option where a change that helps one milestone and hurts another is visible before approving.',
    ],
    built: [
      { label: 'ProposedEditCard', story: 'components-proposededitcard--recovers-time' },
      { label: 'One that makes it worse', story: 'components-proposededitcard--makes-it-worse' },
    ],
  },
  {
    number: '05',
    title: 'Agent steps',
    folder: '05-agent-steps',
    page: 'options.html',
    date: '14 November 2026',
    problem:
      "A planner has to trust the assistant's answer, or see exactly where not to, without reading its working. Only activity codes can be checked against the tool results mechanically; whether a sentence is supported cannot, and a design that implies otherwise looks more certain than the data is.",
    options: [
      {
        letter: 'A',
        name: 'Steps folded; unverified codes marked in place',
        summary:
          'Marks only what can honestly be checked, where it is written; but the working is a click away.',
      },
      {
        letter: 'B',
        name: 'Steps shown while working; each sentence marked',
        summary: 'Every sentence names its source; but implies a check the screen cannot make.',
      },
      {
        letter: 'C',
        name: 'Answer first, an evidence list beneath',
        summary: 'Clean prose; but the evidence is apart from the claim it supports.',
      },
    ],
    chosen: ['A'],
    decision: 'A, steps folded into one line, unverified codes marked in place.',
    decided: 'accepted',
    quote: 'A, steps folded',
    why: [
      'Only activity codes can be checked mechanically, so A marks only what can honestly be checked, where it is written.',
      'B and C imply a sentence by sentence matching that cannot be verified.',
    ],
    built: [
      { label: 'AgentSteps', story: 'components-agentsteps--done' },
      {
        label: 'AgentText with an unverified code',
        story: 'components-agenttext--with-an-unverified-code',
      },
    ],
  },
  {
    number: '06',
    title: 'Density',
    folder: '06-density',
    page: 'options.html',
    date: '11 November 2026',
    problem:
      'Compact is the default for a tool open all day. "Comfortable" is the other setting, and the question is what it changes and what it must never change: if density moves columns or rescales a bar, the two are no longer the same grid.',
    options: [
      {
        letter: 'A',
        name: 'Taller rows only',
        summary: 'Nothing moves; but the text is no easier to read, it only adds air.',
      },
      {
        letter: 'B',
        name: 'Taller rows, larger text, more padding',
        summary: 'Easier to read and still one line per row; but fewer rows on screen.',
      },
      {
        letter: 'C',
        name: 'Two lines per row',
        summary: 'Uses the height for the WBS path; but density changes what a row contains.',
      },
    ],
    chosen: ['B'],
    decision:
      'B: 32px rows, 13px text, 12px cell padding; column widths stay as the planner set them.',
    decided: 'accepted',
    quote: 'use your picks',
    why: [
      'B is the only option that makes the grid easier to read, which is what people ask for, and it keeps one line per row.',
      'C is a different feature: if where an activity sits matters, that is a WBS column.',
    ],
    built: [
      { label: 'Density', story: 'foundations-density--grid' },
      { label: 'Changes grid, comfortable', story: 'screens-changes-grid--comfortable' },
    ],
  },
  {
    number: '07',
    title: 'Scale honesty',
    folder: '07-scale-honesty',
    page: 'options.html',
    date: '11 November 2026',
    problem:
      'The grid shows about 25 rows of 350,000. A planner must always be able to tell how many rows the view holds, how many are hidden and why, and where they are. At this size the native scrollbar stops meaning much, and the grid cannot simply be a very tall element.',
    options: [
      {
        letter: 'A',
        name: 'A status line under the grid',
        summary:
          'Always present, exact in rows; but away from the filter that caused the hidden rows.',
      },
      {
        letter: 'B',
        name: 'Counts beside the filter, a readout while scrolling',
        summary: 'Cause and effect side by side; but no position when not scrolling.',
      },
      {
        letter: 'C',
        name: 'An overview strip in place of the scrollbar',
        summary: 'Shows the shape of the changes; but a second thing to learn.',
      },
    ],
    chosen: ['A', 'B'],
    decision: "A, a status line under the grid, with B's readout while scrolling.",
    decided: 'accepted',
    quote: 'use your picks',
    why: [
      'A keeps the count of hidden rows where it cannot be scrolled away, and gives a position that does not depend on the scrollbar.',
      "B's readout covers the moment A is weakest; built for wheel and keyboard as well as dragging.",
    ],
    built: [
      { label: 'Changes grid at a million rows', story: 'screens-changes-grid--a-million-rows' },
    ],
  },
  {
    number: '08',
    title: 'Import warnings',
    folder: '08-import-warnings',
    page: 'options.html',
    date: '11 November 2026',
    problem:
      'A real P6 export is rarely clean: a 350,000 activity file can give 3,000 warnings. The report must answer "can I trust what loaded" without alarming or burying the two logic loops that change dates, and cannot use warm colours, which mean late.',
    options: [
      {
        letter: 'A',
        name: 'One list, largest first',
        summary: 'Simplest, and Slip judges nothing; but the largest count is the least important.',
      },
      {
        letter: 'B',
        name: 'Grouped by what it means for the answer',
        summary:
          'Leads with what may change dates, however few; but Slip makes a judgement about planning.',
      },
      {
        letter: 'C',
        name: 'One sentence, the report in a drawer',
        summary: 'Short and even; but the detail is a click away.',
      },
    ],
    chosen: ['B'],
    decision: 'B, grouped by what it means for the answer.',
    decided: 'chose',
    quote: 'i will choose B',
    why: [
      'B is the only option that answers "can I trust what loaded" in the slot itself, hiding nothing behind a click.',
      'The grouping of all 17 kinds of warning is a judgement made without a planner, and is open.',
    ],
    built: [{ label: 'Import with warnings', story: 'screens-import--populated-with-warnings' }],
  },
  {
    number: '09',
    title: 'Where your data goes',
    folder: '09-data-flow',
    page: 'options.html',
    date: '15 November 2026',
    problem:
      "Customers ask where their data goes, and the honest answer depends on the assistant's mode. The panel must say both without overclaiming, always match what the code does, and convince an information-security reviewer, not only reassure a planner.",
    options: [
      {
        letter: 'A',
        name: 'A diagram of three places',
        summary: 'The diagram the spec asks for; but a drawing does not say what makes it true.',
      },
      {
        letter: 'B',
        name: 'The security table, with how it is held to',
        summary:
          'Exact, and a test can hold it to the written statements; but a table, not a picture.',
      },
      {
        letter: 'C',
        name: 'What was actually sent this session',
        summary: 'Shows real behaviour; but empty in scripted mode.',
      },
    ],
    chosen: ['B'],
    decision: 'B, the table with how each row is held to, opened from a link in the footer.',
    decided: 'accepted',
    quote: 'B, footer link',
    why: [
      'B is the most exact for an IT reviewer, and the only option a test can keep equal to docs/data-flow.md and the security spec.',
      'The footer is on every screen already.',
    ],
    built: [{ label: 'Where your data goes', story: 'screens-where-your-data-goes--live' }],
  },
  {
    number: '10',
    title: 'The activity drawer',
    folder: '10-activity-drawer',
    page: 'options.html',
    date: '15 November 2026',
    problem:
      'Select a row and ask "what happened to this one, and why?" in about 300px under the grid. The drawer is also where the Gantt\'s facts become text for anyone who cannot use the canvas, so nothing can be left out, and the answer usually needs two facts at once.',
    options: [
      {
        letter: 'A',
        name: 'Five tabs, as the spec lists them',
        summary: 'Exactly the spec; but the cause and its effect sit on different tabs.',
      },
      {
        letter: 'B',
        name: 'Everything at once, in three columns',
        summary: 'The cause is usually in view; but too dense for 300px.',
      },
      {
        letter: 'C',
        name: 'Led by what changed, with the reason',
        summary: "Answers the question first; but departs from the spec's five tabs.",
      },
    ],
    chosen: ['C'],
    decision: 'C, led by what changed and one sentence on why it moved; the rest a tab away.',
    decided: 'accepted',
    quote: 'C, led by changes',
    why: [
      "It answers the planner's question first: the fields and links that changed, and why the activity moved.",
      "The departure from the spec's five tabs is recorded in the UI spec.",
    ],
    built: [{ label: 'Activity drawer', story: 'screens-activity-drawer--populated' }],
  },
  {
    number: '11',
    title: 'Relationship lines',
    folder: '11-relationship-lines',
    page: 'options.html',
    date: '15 November 2026',
    problem:
      "P6 draws every link because its rows are in logic order. Slip's rows are a sorted, filtered window onto a million activities, so linked activities are rarely near each other, and drawing every link makes a tangle or quietly leaves most of them out.",
    options: [
      {
        letter: 'A',
        name: 'Every link between the rows on screen',
        summary:
          'What a P6 user expects; but a tangle under the default sort, and off-screen links vanish.',
      },
      {
        letter: 'B',
        name: "The selected activity's links only",
        summary: 'Readable in any sort; but every link looks alike.',
      },
      {
        letter: 'C',
        name: 'Its driving path, and what changed',
        summary: 'Draws the cause of the move; but nothing is drawn until a row is selected.',
      },
    ],
    chosen: ['C'],
    decision:
      "C, the selected activity's links, its driving path heavy, the links that changed labelled.",
    decided: 'accepted',
    quote: 'C, driving path',
    why: [
      'It is the only option where the lines answer the question Slip exists for: why did this move.',
      'It matches the activity drawer and reuses the same trace. B is the fallback if C proves too busy.',
    ],
    built: [{ label: 'Changes grid, row selected', story: 'screens-changes-grid--row-selected' }],
  },
  {
    number: '12',
    title: 'The mention picker',
    folder: '12-mention-picker',
    page: 'options.html',
    date: '17 November 2026',
    problem:
      'A planner wants to point the assistant at an activity without copying its code. "Install catenary" can match a thousand rows, so the picker must narrow fast and say what it is not showing, send the model a code it can cite, and leave a question the planner can still read.',
    options: [
      {
        letter: 'A',
        name: 'A list at the caret; the code goes in the text',
        summary: 'The question reads exactly as sent; but codes are hard to read back.',
      },
      {
        letter: 'B',
        name: 'A list at the caret; the choice becomes a chip',
        summary: 'Reads best; but a field that holds chips is hard to make accessible.',
      },
      {
        letter: 'C',
        name: 'A tray above the input',
        summary: 'The selected activity is one click away; but not a # in the text.',
      },
    ],
    chosen: ['A', 'C'],
    decision:
      'A, with one idea from C: typing # alone offers the activity selected in the grid first.',
    decided: 'accepted',
    quote: 'A, code in the text',
    why: [
      'It keeps a plain textarea, the most robust and accessible field.',
      'The question reads exactly as it is sent, and the code is what the model already looks up and cites.',
    ],
    built: [
      { label: 'MentionInput', story: 'components-mentioninput--populated' },
      { label: 'Selected activity first', story: 'components-mentioninput--selected-first' },
    ],
  },
];

export interface Layout {
  screen: string;
  /** The drawing under docs/design/flows. */
  page: string;
  options: string;
  chosen: string;
  date: string;
  decided: Decided;
  story: string;
}

/** The low-fidelity screen layouts, drawn before each screen was built. */
export const LAYOUTS: Layout[] = [
  {
    screen: 'Import',
    page: 'import.html',
    options: 'A two slots side by side; B one ledger with two rows; C one file at a time',
    chosen: 'A, two slots side by side',
    date: '11 November 2026',
    decided: 'accepted',
    story: 'screens-import--populated',
  },
  {
    screen: 'Update summary',
    page: 'summary.html',
    options:
      'A milestones full width with a strip below; B milestones with a rail; C one sentence, then the evidence',
    chosen: 'B, milestones with a rail',
    date: '11 November 2026',
    decided: 'accepted',
    story: 'screens-update-summary--populated',
  },
  {
    screen: 'Changes',
    page: 'changes.html',
    options:
      'A grid and Gantt side by side; B grid with a small timeline in each row; C change types down the left',
    chosen: 'A, grid and Gantt side by side',
    date: '11 November 2026',
    decided: 'accepted',
    story: 'screens-changes-grid--with-gantt',
  },
  {
    screen: 'Health',
    page: 'health.html',
    options:
      'A what changed first, then the rest; B all 14 in DCMA order; C checks on the left, the chosen one on the right',
    chosen: 'A, what changed first',
    date: '12 November 2026',
    decided: 'accepted',
    story: 'screens-health--populated',
  },
  {
    screen: 'Finish update',
    page: 'narrative.html',
    options:
      'A one document, evidence in the margin; B paragraph blocks, each with its evidence; C choose the facts, then the words',
    chosen: 'B, paragraph blocks',
    date: '14 November 2026',
    decided: 'accepted',
    story: 'screens-finish-update--generated',
  },
];

export const DECIDED: Record<Decided, string> = {
  own: 'Chosen by Usman, for his own reasons.',
  chose:
    "Chosen by Usman. He gave no reasons, so the reasons below are Claude's, and he has not yet put them in his own words.",
  accepted:
    "Usman accepted Claude's recommendation. The reasons below are Claude's, which he accepted.",
};

/** Where the drawings are served in Storybook (staticDirs in .storybook/main.ts). */
export const DESIGN_ROOT = 'design';
export const SOURCE = 'https://github.com/usmankadai/slip/tree/main/docs/design';
