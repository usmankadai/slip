/**
 * Finds the activities for a `#` mention in the assistant's question (exploration 12, option A).
 * Uses the grid's own engine search over codes and names, sorted by finish slip, and holds only
 * the few rows shown.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RowsResult } from '@slip/engine';
import type { MentionList, MentionOption } from '@slip/ui';
import { NONE } from '@slip/xer';
import { engine } from '../../app/engine.ts';
import { EngineRequestError } from '../../workers/engineClient.ts';

/** How many options the list shows. */
export const SHOWN = 6;
/** Waits this long after the last key before searching, so a fast typist does not queue searches. */
const PAUSE_MS = 120;

const SLIPPED_MOST = { column: 'finishDeltaDays', direction: 'desc' } as const;

function optionsOf(result: RowsResult): MentionOption[] {
  const codes = result.text.code ?? [];
  const names = result.text.name ?? [];
  const slips = result.numbers.finishDeltaDays;
  return codes.map((code, k) => {
    const slip = slips?.[k] ?? NONE;
    return { code, name: names[k] ?? '', slipDays: slip === NONE ? null : slip / 100 };
  });
}

const search = (text: string, range: [number, number], sorted: boolean) =>
  engine().request(
    {
      type: 'rows',
      slot: 'b',
      range,
      columns: ['code', 'name', 'finishDeltaDays'],
      filter: text ? { text } : {},
      sort: sorted ? SLIPPED_MOST : null,
    },
    { supersedes: sorted ? 'mention' : 'mention-selected' },
  );

/**
 * What to list for a mention. With nothing typed after `#`, the activity selected in the grid
 * comes first and the activities that slipped most fill the rest.
 */
async function find(query: string, selected: string | undefined): Promise<MentionList> {
  if (query !== '' || !selected) {
    const result = await search(query, [0, SHOWN], true);
    return { state: 'ready', options: optionsOf(result), total: result.total };
  }
  const [mine, most] = await Promise.all([
    search(selected, [0, 50], false),
    search('', [0, SHOWN], true),
  ]);
  const chosen = optionsOf(mine).find((option) => option.code === selected);
  const rest = optionsOf(most).filter((option) => option.code !== selected);
  const options = chosen
    ? [{ ...chosen, note: 'Selected in the grid' }, ...rest].slice(0, SHOWN)
    : rest;
  return { state: 'ready', options, total: most.total };
}

export function useMentions(selected: string | undefined) {
  const [query, setQuery] = useState<string | null>(null);
  const [list, setList] = useState<MentionList | null>(null);
  const asked = useRef(0);

  useEffect(() => {
    const token = ++asked.current;
    if (query === null) {
      setList(null);
      return;
    }
    // Keeps the last options on screen while the next search runs, so the list does not flicker.
    setList((held) =>
      held?.state === 'ready' && held.options.length > 0 ? held : { state: 'loading' },
    );
    const timer = setTimeout(
      () => {
        find(query, selected).then(
          (found) => {
            if (asked.current === token) setList(found);
          },
          (reason: unknown) => {
            if (asked.current !== token) return;
            if (
              reason instanceof EngineRequestError &&
              ['superseded', 'cancelled'].includes(reason.code)
            ) {
              return;
            }
            setList({ state: 'error', message: 'Slip could not search the activities.' });
          },
        );
      },
      query === '' ? 0 : PAUSE_MS,
    );
    return () => clearTimeout(timer);
  }, [query, selected]);

  const onMentionQuery = useCallback((next: string | null) => setQuery(next), []);
  return { list, onMentionQuery };
}
