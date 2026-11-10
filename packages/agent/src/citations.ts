/**
 * Citations are checked, not trusted. The agent is told to cite activities
 * as #CODE. A code only counts if a tool result in this answer contained it;
 * anything else is shown as plain text and marked unverified.
 */

/** A # followed by an activity code: letters, digits, and . _ - / inside it. */
const CITATION = /#([A-Za-z0-9][A-Za-z0-9._/-]{0,79})/g;

export interface TextPart {
  kind: 'text' | 'verified' | 'unverified';
  /** For citations, the activity code without the #. */
  text: string;
}

/** Splits answer text into plain text and citations, each marked verified or not. */
export function splitCitations(text: string, known: ReadonlySet<string>): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(CITATION)) {
    let code = match[1]!;
    // Sentence punctuation after a code is not part of it.
    while (code.length > 1 && /[._/-]$/.test(code) && !known.has(code)) code = code.slice(0, -1);
    const start = match.index;
    if (start > last) parts.push({ kind: 'text', text: text.slice(last, start) });
    parts.push({ kind: known.has(code) ? 'verified' : 'unverified', text: code });
    last = start + 1 + code.length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

/**
 * Collects the activity codes a tool result mentions, by looking for string
 * values under keys that hold codes. Tool results are built by our own code,
 * so the keys are known.
 */
export function codesInResult(result: unknown, into: Set<string> = new Set()): Set<string> {
  const visit = (value: unknown, key: string): void => {
    if (typeof value === 'string') {
      if (/(^|_)(code|task_code|predecessor|successor)$/.test(key)) into.add(value);
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item, key);
    } else if (value !== null && typeof value === 'object') {
      for (const [inner, child] of Object.entries(value)) visit(child, inner);
    }
  };
  visit(result, '');
  return into;
}
