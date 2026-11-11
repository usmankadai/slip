/**
 * The import report (exploration 08, option B): warnings grouped by what they
 * mean for the answer. The grouping is a judgement about planning and is
 * recorded as the agent's in the exploration; change it here and there together.
 */
import type { ImportWarning, WarningKind } from '@slip/xer';
import { count, share } from '../../shared/format.ts';

export type WarningGroupId = 'dates' | 'compare' | 'repair';

interface KindCopy {
  group: WarningGroupId;
  name: string;
  /** What Slip did about it, as a sentence. */
  did: string;
  /** What the count is a share of, when that is meaningful. */
  of?: 'activities' | 'relationships' | 'rows';
}

const KINDS: Record<WarningKind, KindCopy> = {
  'truncated-file': {
    group: 'dates',
    name: 'The file stops early',
    did: 'Everything up to the break was read. Activities or relationships after it are missing.',
  },
  'relationship-missing-task': {
    group: 'dates',
    name: 'Relationships to activities that are not in the file',
    did: 'Left out. Their successors may show earlier dates than in P6.',
    of: 'relationships',
  },
  'relationship-external': {
    group: 'dates',
    name: 'Relationships to activities in another project',
    did: 'Left out and counted as external. Dates driven from another project will differ from P6.',
    of: 'relationships',
  },
  'relationship-self': {
    group: 'dates',
    name: 'Activities linked to themselves',
    did: 'The relationship was left out.',
    of: 'relationships',
  },
  'unknown-relationship-type': {
    group: 'dates',
    name: 'Relationship types Slip does not recognise',
    did: 'Kept, and treated as finish to start when dates are recalculated.',
    of: 'relationships',
  },
  'missing-calendar': {
    group: 'dates',
    name: 'Activities with no calendar',
    did: 'The project default calendar was used.',
    of: 'activities',
  },
  'calendar-fallback': {
    group: 'dates',
    name: 'Calendars that could not be read',
    did: 'A Monday to Friday week was used in their place.',
  },
  'invalid-date': {
    group: 'dates',
    name: 'Dates that could not be read',
    did: 'Treated as no date.',
  },
  'unknown-constraint-type': {
    group: 'dates',
    name: 'Constraint types Slip does not recognise',
    did: 'Shown as Unknown and not applied when dates are recalculated.',
    of: 'activities',
  },
  'duplicate-task-code': {
    group: 'compare',
    name: 'Duplicate activity codes',
    did: 'The first of each is compared with the other update. The rest are kept but not compared.',
    of: 'activities',
  },
  'multiple-projects': {
    group: 'compare',
    name: 'Several projects in one file',
    did: 'One project was read. Choose a different one above if it is the wrong one.',
  },
  'row-field-count': {
    group: 'repair',
    name: 'Rows with the wrong number of fields',
    did: 'Short rows were padded and long rows cut to fit the table.',
    of: 'rows',
  },
  'continuation-line': {
    group: 'repair',
    name: 'Text that runs over more than one line',
    did: 'The extra lines were skipped. Slip does not use those fields.',
    of: 'rows',
  },
  'missing-field': {
    group: 'repair',
    name: 'Columns missing from a table',
    did: 'Read as empty.',
  },
  'unknown-task-type': {
    group: 'repair',
    name: 'Activity types Slip does not recognise',
    did: 'Shown as Unknown.',
    of: 'activities',
  },
  'unknown-status': {
    group: 'repair',
    name: 'Activity statuses Slip does not recognise',
    did: 'Shown as Unknown.',
    of: 'activities',
  },
  'missing-wbs': {
    group: 'repair',
    name: 'Activities with no WBS',
    did: 'Placed under Unassigned.',
    of: 'activities',
  },
};

const GROUPS: { id: WarningGroupId; title: string }[] = [
  { id: 'dates', title: 'May change dates' },
  { id: 'compare', title: 'Changes what is compared' },
  { id: 'repair', title: 'Repaired while reading, no effect on dates' },
];

export interface ReportRow {
  kind: string;
  name: string;
  count: number;
  did: string;
  /** "0.02% of 498,864 relationships", or '' when there is nothing sensible to compare with. */
  share: string;
  examples: string[];
}

export interface ReportGroup {
  id: WarningGroupId;
  title: string;
  total: number;
  rows: ReportRow[];
}

export interface Report {
  total: number;
  kinds: number;
  groups: ReportGroup[];
}

export interface ReportTotals {
  activities: number;
  relationships: number;
  /** Rows read from the file, or 0 when not known (a schedule opened from the cache). */
  rows: number;
}

/** A kind the parser reports that this build has no wording for. It is still shown, never dropped. */
const UNKNOWN_KIND: KindCopy = {
  group: 'dates',
  name: 'Another kind of warning',
  did: 'Slip has no description for this kind yet. Treat the file with care.',
};

export function buildReport(warnings: readonly ImportWarning[], totals: ReportTotals): Report {
  const groups: ReportGroup[] = GROUPS.map((group) => ({ ...group, total: 0, rows: [] }));
  let total = 0;
  let kinds = 0;
  for (const warning of warnings) {
    if (!(warning.count > 0)) continue;
    const copy = Object.hasOwn(KINDS, warning.kind) ? KINDS[warning.kind] : UNKNOWN_KIND;
    const denominator = copy.of ? totals[copy.of] : 0;
    const group = groups.find((candidate) => candidate.id === copy.group)!;
    group.rows.push({
      kind: warning.kind,
      name: copy.name,
      count: warning.count,
      did: copy.did,
      share:
        copy.of && denominator > 0
          ? `${share(warning.count, denominator)} of ${count(denominator)} ${copy.of}`
          : '',
      examples: warning.examples.filter((example) => example.trim() !== '').slice(0, 20),
    });
    group.total += warning.count;
    total += warning.count;
    kinds++;
  }
  for (const group of groups) group.rows.sort((a, b) => b.count - a.count);
  return { total, kinds, groups: groups.filter((group) => group.rows.length > 0) };
}
