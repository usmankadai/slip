/** A `#` mention being typed: where it starts and ends in the text, and what follows the `#`. */
export interface Mention {
  /** Index of the `#`. */
  start: number;
  /** One past the last character of the mention, which may be beyond the caret. */
  end: number;
  query: string;
}

const SPACE = /\s/;

/**
 * The mention the caret is in, or null. A mention is a `#` at the start of the text or after
 * white space, followed by anything but white space, with the caret after the `#`.
 */
export function mentionAt(text: string, caret: number): Mention | null {
  if (caret < 1 || caret > text.length) return null;
  let start = caret - 1;
  while (start >= 0 && text[start] !== '#') {
    if (SPACE.test(text[start]!)) return null;
    start--;
  }
  if (start < 0) return null;
  if (start > 0 && !SPACE.test(text[start - 1]!)) return null;
  let end = caret;
  while (end < text.length && !SPACE.test(text[end]!)) end++;
  return { start, end, query: text.slice(start + 1, end) };
}

/** Replaces the mention with `#code` and one space, and gives where the caret goes after it. */
export function insertMention(
  text: string,
  mention: Mention,
  code: string,
): { text: string; caret: number } {
  const after = text.slice(mention.end);
  const written = `#${code}${after.startsWith(' ') ? '' : ' '}`;
  return {
    text: text.slice(0, mention.start) + written + after,
    caret: mention.start + written.length + (after.startsWith(' ') ? 1 : 0),
  };
}
