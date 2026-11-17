import type { Meta, StoryObj } from '@storybook/react-vite';
import { formatDelta } from '@slip/ui';
import { GuidePage, GuideSection, GuideTable, GuideText, GuideLink, SPEC } from '@slip/ui/guide';
import { MINUTES_PER_DAY, epochDay } from '@slip/xer';
import { count, longDate, megabytes, plural, share, shortDate, workingDays } from './format.ts';

const SEPTEMBER_7 = epochDay(2027, 9, 7) * MINUTES_PER_DAY;

/** What Slip writes, drawn by the functions the screens use, so the page shows the real output. */
const FORMATS: [string, string, string, string][] = [
  [
    'A date in a sentence',
    longDate(SEPTEMBER_7),
    '07/09/2027, 2027-09-07, September 7th',
    'Day, month in full, year. Never numbers alone: 07/09 is a different day in the US.',
  ],
  [
    'A date in a grid cell',
    shortDate(SEPTEMBER_7),
    '07-SEP-27',
    'Three-letter month, four-digit year.',
  ],
  [
    'Slip',
    `${formatDelta(67)}, ${formatDelta(-3)}, ${formatDelta(0)}`,
    '67, -3 days, 67 days late',
    'Signed working days with the unit d. A true minus sign, so it lines up with plus.',
  ],
  [
    'A duration or float',
    `${workingDays(700)}, ${workingDays(250)}`,
    '7 days, 2.50',
    'Working days, at most one decimal place.',
  ],
  [
    'A count',
    plural(350412, 'activity', 'activities'),
    '350412 activities, 350.4K',
    'Every digit, grouped, with what is being counted.',
  ],
  ['A share', share(12, 350412), '0%', 'Never rounds a real number down to nothing.'],
  [
    'A file size',
    `${megabytes(84_200_000)} MB`,
    '84,200,000 bytes',
    'Megabytes, one decimal place under 10.',
  ],
  [
    'A large total in a sentence',
    `${count(1204)} activities match`,
    'about 1.2K matches',
    'Exact. Slip is honest about what it is not showing.',
  ],
];

const WORDS: [string, string, string][] = [
  [
    'Update A, update B',
    'Baseline, current, old, new',
    'A baseline is a different thing in P6. A is the earlier update, B the later.',
  ],
  [
    'Activity',
    'Task, item, row',
    'What P6 and planners call it, even though the XER table is TASK.',
  ],
  ['Slip', 'Delay, variance', 'How far a finish moved between the two updates, in working days.'],
  ['Data date', 'Status date, as-of date', "P6's term for the date progress was recorded to."],
  ['Total float', 'Slack, buffer', "P6's term."],
  ['Driving path', 'Critical chain, cause chain', "The predecessors that set an activity's dates."],
  [
    'The assistant',
    'The AI, the bot, the agent',
    'Plain, and it does not oversell. Scripted answers say "Scripted answer, not AI".',
  ],
  [
    'Finish update',
    'Report generator, export wizard',
    "Names the planner's step, not the machinery.",
  ],
];

const TONE: [string, string, string][] = [
  [
    'An error',
    'Slip could not read update B: it is not an XER file. Update A is still loaded.',
    'Error: parse failed (code 3)!',
  ],
  ['Nothing to show', 'No milestone moved between these updates.', 'No data.'],
  [
    'A limit',
    '1,204 activities match. Showing the 6 that slipped most. Keep typing to narrow.',
    'Too many results',
  ],
  [
    'A warning',
    'Two logic loops were broken to calculate dates. Dates on these 14 activities may differ from P6.',
    'Warning! Your schedule has problems.',
  ],
];

function ContentPage() {
  return (
    <GuidePage
      eyebrow="Guidelines"
      title="Content"
      lead="Plain British English, sentence case, no em dashes and no exclamation marks, in the words planners already use. Every number is tabular, right aligned and carries its unit."
    >
      <GuideSection id="formats" title="Numbers and dates">
        <GuideText quiet>
          The middle column is written by the same functions the screens use, so this page cannot
          drift from them.
        </GuideText>
        <GuideTable
          caption="Number and date formats"
          head={['What', 'Slip writes', 'Not', 'Why']}
          rows={FORMATS}
          numeric={[1]}
        />
      </GuideSection>
      <GuideSection id="words" title="Words">
        <GuideTable caption="Vocabulary" head={['Write', 'Not', 'Why']} rows={WORDS} />
      </GuideSection>
      <GuideSection id="tone" title="Tone">
        <GuideText>
          Say what happened, what still works and what to do next. Calm about size, exact about
          numbers, and never more certain than the data.
        </GuideText>
        <GuideTable caption="Tone" head={['When', 'Write', 'Not']} rows={TONE} />
        <GuideText quiet>
          Source: <GuideLink href={`${SPEC}/ui.md`}>the UI spec</GuideLink>. The copy rules are part
          of the <GuideLink href={`${SPEC}/design.md`}>design review checklist</GuideLink>.
        </GuideText>
      </GuideSection>
    </GuidePage>
  );
}

/** A written page: guidance, not a component. Lives in the app so it can use the app's formatters. */
const meta: Meta = { title: 'Guidelines/Content' };
export default meta;

export const Content: StoryObj = { name: 'Content', render: () => <ContentPage /> };
