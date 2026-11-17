import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from 'react';
import { formatDelta } from '../DeltaCell/DeltaCell.tsx';
import { insertMention, mentionAt } from './mention.ts';
import styles from './MentionInput.module.css';

export interface MentionOption {
  /** The activity code, exactly as in P6. This is what is written into the text. */
  code: string;
  name: string;
  /** Finish slip in working days, or null when there is none to show. */
  slipDays: number | null;
  /** A few words on why this option is here, such as "Selected in the grid". */
  note?: string;
}

/** What the list shows for the mention being typed. The caller searches; this only draws. */
export type MentionList =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; options: readonly MentionOption[]; total: number };

export interface MentionInputProps extends Pick<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'placeholder' | 'maxLength' | 'rows' | 'disabled'
> {
  /** The textarea's id, for the caller's label. */
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Enter without Shift, when no list is open. */
  onSubmit: () => void;
  /** Called with the text after `#` while the caret is in a mention, and null when it leaves one. */
  onMentionQuery: (query: string | null) => void;
  /** The list for the current mention; null shows no list. */
  list: MentionList | null;
}

const count = (n: number) => n.toLocaleString('en-GB');

function caption(list: MentionList, query: string): string {
  if (list.state === 'loading') return 'Searching activities';
  if (list.state === 'error') return list.message;
  const shown = list.options.length;
  if (query === '') {
    return shown > 0 ? 'Type to search codes and names' : 'Type part of an activity code or name';
  }
  if (list.total === 0) return `No activity code or name contains "${query}".`;
  if (list.total <= shown) {
    return list.total === 1 ? '1 activity matches' : `${count(list.total)} activities match`;
  }
  return `${count(list.total)} activities match. Showing the ${shown} that slipped most. Keep typing to narrow.`;
}

/**
 * A question box where `#` opens a list of activities, and choosing one writes its code into the
 * text (exploration 12, option A). The text stays exactly what is sent.
 */
export function MentionInput({
  id,
  value,
  onChange,
  onSubmit,
  onMentionQuery,
  list,
  ...rest
}: MentionInputProps) {
  const box = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  // Starts at the end, where the caret goes when the box is first focused after typing.
  const [caret, setCaret] = useState(value.length);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const nextCaret = useRef<number | null>(null);

  const mention = mentionAt(value, caret);
  const query = mention ? mention.query : null;
  const open = mention !== null && mention.start !== dismissed && list !== null;
  const options = open && list.state === 'ready' ? list.options : [];

  useEffect(() => {
    onMentionQuery(query);
  }, [query, onMentionQuery]);

  const outside = mention === null;
  useEffect(() => {
    if (outside) setDismissed(null);
  }, [outside]);

  useEffect(() => {
    setActive(0);
  }, [list]);

  useLayoutEffect(() => {
    if (nextCaret.current === null || !box.current) return;
    box.current.setSelectionRange(nextCaret.current, nextCaret.current);
    nextCaret.current = null;
  }, [value]);

  const choose = (option: MentionOption) => {
    if (!mention) return;
    const next = insertMention(value, mention, option.code);
    nextCaret.current = next.caret;
    setCaret(next.caret);
    onChange(next.text);
    box.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && options.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((at) => (at + step + options.length) % options.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        choose(options[Math.min(active, options.length - 1)]!);
        return;
      }
    }
    if (open && event.key === 'Escape') {
      // Closes the list only, not the panel around it.
      event.preventDefault();
      event.stopPropagation();
      setDismissed(mention.start);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <div className={styles.field}>
      {open ? (
        <div className={styles.pop}>
          <p className={styles.caption} role="status">
            {caption(list, mention.query)}
          </p>
          {options.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Activities" className={styles.list}>
              {options.map((option, index) => (
                <li
                  key={option.code}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  className={`${styles.option} ${index === active ? styles.active : ''}`}
                  // Keeps focus, and the caret, in the textarea.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <span className={styles.name}>{option.name}</span>
                  <span className={styles.code}>
                    {option.code}
                    {option.note ? <span className={styles.note}>{option.note}</span> : null}
                  </span>
                  <span
                    className={`${styles.slip} ${
                      option.slipDays === null || Math.round(option.slipDays * 10) === 0
                        ? ''
                        : option.slipDays > 0
                          ? styles.late
                          : styles.early
                    }`}
                  >
                    {option.slipDays === null ? 'None' : formatDelta(option.slipDays)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <textarea
        ref={box}
        id={id}
        className={styles.input}
        value={value}
        aria-autocomplete="list"
        aria-controls={options.length > 0 ? listId : undefined}
        aria-activedescendant={
          options.length > 0 ? optionId(Math.min(active, options.length - 1)) : undefined
        }
        onChange={(event) => {
          setCaret(event.target.selectionStart);
          onChange(event.target.value);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        {...rest}
      />
    </div>
  );
}
