/**
 * The parts of the design spec the written pages show, read from the spec itself so a page can
 * never say something different from it.
 */
import design from '../../../../docs/spec/design.md?raw';
import ui from '../../../../docs/spec/ui.md?raw';
import { parseContract, type Contract } from './contract.ts';

const strip = (text: string) => text.replace(/\*\*/g, '').replace(/`/g, '').trim();

/** The lines of one `## ` section, without its heading. */
function section(markdown: string, heading: string): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && /^##? /.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

/** Rows of the first Markdown table in some lines, header first. */
function table(lines: string[]): string[][] {
  return lines
    .filter((line) => line.startsWith('|') && !/^\|\s*-/.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => strip(cell)),
    );
}

export interface Goal {
  title: string;
  text: string;
}

/** "1. **Answer the planner's question first.** Every screen has..." */
export function designGoals(markdown = design): Goal[] {
  return section(markdown, 'Design goals')
    .filter((line) => /^\d+\. \*\*/.test(line))
    .map((line) => {
      const match = /^\d+\. \*\*(.+?)\*\*\s*(.*)$/.exec(line)!;
      return { title: match[1]!.replace(/\.$/, ''), text: strip(match[2]!) };
    });
}

export interface IdentityRow {
  element: string;
  decision: string;
  reason: string;
}

export function identity(markdown = design): IdentityRow[] {
  const rows = table(section(markdown, 'Visual identity'));
  return rows.slice(1).map(([element = '', decision = '', reason = '']) => ({
    element,
    decision,
    reason,
  }));
}

/** The bullets at the top of the UI spec: the interaction principles. */
export function uiPrinciples(markdown = ui): { title: string; text: string }[] {
  const lines = markdown.split('\n');
  const end = lines.findIndex((line) => line.startsWith('## '));
  return lines
    .slice(0, end)
    .filter((line) => line.startsWith('- **'))
    .map((line) => {
      const match = /^- \*\*(.+?)\*\*:?\s*(.*)$/.exec(line)!;
      return { title: match[1]!.replace(/[.:]$/, ''), text: strip(match[2]!) };
    });
}

/** The design review checklist, every new or changed screen. */
export function reviewChecklist(markdown = design): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith('## Design review checklist'));
  return lines
    .slice(start + 1)
    .filter(
      (line, index, all) =>
        line.startsWith('- ') && all.slice(0, index).every((l) => !l.startsWith('## ')),
    )
    .map((line) => strip(line.slice(2)));
}

const READMES = import.meta.glob<string>('../components/*/README.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Every component's contract, in alphabetical order. */
export const CONTRACTS: Contract[] = Object.values(READMES)
  .map((markdown) => parseContract(markdown))
  .sort((a, b) => a.name.localeCompare(b.name));
