/**
 * Reads a component's README: its contract, and its correct and incorrect examples. The "Do and
 * do not" page draws these, and AGENTS.md points agents at the same files, so the guidance for
 * people and for agents comes from one place.
 */
export interface Contract {
  name: string;
  useFor: string;
  notFor: string;
  rules: string[];
  correct: string;
  incorrect: string;
}

/** Drops Markdown's own marks from a line of prose; the page draws it as text. */
const plain = (line: string) => line.replace(/\*\*/g, '').replace(/`/g, '').trim();

function after(lines: string[], heading: string): string {
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return '';
  const open = lines.findIndex((line, index) => index > start && line.startsWith('```'));
  const close = lines.findIndex((line, index) => index > open && line.startsWith('```'));
  if (open < 0 || close < 0) return '';
  return lines.slice(open + 1, close).join('\n');
}

export function parseContract(markdown: string): Contract {
  const lines = markdown.split('\n');
  const name = (lines.find((line) => line.startsWith('# ')) ?? '').slice(2).trim();
  const field = (label: string) => {
    const line = lines.find((entry) => entry.startsWith(`- **${label}**`));
    return line ? plain(line.slice(`- **${label}**`.length)) : '';
  };
  const rulesAt = lines.findIndex((line) => line.startsWith('- **Rules:**'));
  const rules: string[] = [];
  if (rulesAt >= 0) {
    const inline = plain(lines[rulesAt]!.slice('- **Rules:**'.length));
    if (inline) rules.push(inline);
    for (let i = rulesAt + 1; i < lines.length && lines[i]!.startsWith('  - '); i++) {
      rules.push(plain(lines[i]!.slice(4)));
    }
  }
  return {
    name,
    useFor: field('Use for'),
    notFor: field('Do not use for'),
    rules,
    correct: after(lines, '## Correct'),
    incorrect: after(lines, '## Incorrect'),
  };
}
