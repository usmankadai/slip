import type { ReactNode } from 'react';
import { EntityChip } from '../EntityChip/EntityChip.tsx';
import styles from './AgentText.module.css';

export interface AgentTextPart {
  kind: 'text' | 'verified' | 'unverified';
  /** For a citation, the activity code. */
  text: string;
  /** Written in bold. */
  strong?: boolean;
}

/** The shapes an answer may take: the allow-list. Anything else is text. */
export type AgentTextBlock =
  | { kind: 'paragraph'; parts: readonly AgentTextPart[] }
  | { kind: 'list'; ordered: boolean; items: readonly (readonly AgentTextPart[])[] }
  | {
      kind: 'table';
      head: readonly (readonly AgentTextPart[])[];
      rows: readonly (readonly (readonly AgentTextPart[])[])[];
    };

export interface AgentTextProps {
  /** The answer as one paragraph, already split into text and checked citations. */
  parts?: readonly AgentTextPart[];
  /** Or the answer as paragraphs, lists and tables (`answerBlocks` from `@slip/agent`). */
  blocks?: readonly AgentTextBlock[];
  /** Opens a cited activity. */
  onOpen: (code: string) => void;
}

function Parts({
  parts,
  onOpen,
}: {
  parts: readonly AgentTextPart[];
  onOpen: (code: string) => void;
}) {
  return parts.map((part, index) => {
    const content: ReactNode =
      part.kind === 'verified' ? (
        <EntityChip
          kind="activity"
          label={part.text}
          description={`Open activity ${part.text}`}
          onOpen={() => onOpen(part.text)}
        />
      ) : part.kind === 'unverified' ? (
        <span>
          <span className={styles.unverified}>{part.text}</span>
          <span className={styles.flag}>unverified</span>
        </span>
      ) : (
        part.text
      );
    return part.strong ? (
      <strong key={index}>{content}</strong>
    ) : (
      <span key={index}>{content}</span>
    );
  });
}

/**
 * An answer from the assistant. A cited activity that was in the tool results is a chip;
 * one that was not is plain text marked "unverified" where it stands (exploration 05).
 * Paragraphs, lists and tables are drawn as elements; nothing is ever read as HTML.
 */
export function AgentText({ parts, blocks, onOpen }: AgentTextProps) {
  const all: readonly AgentTextBlock[] = blocks ?? [{ kind: 'paragraph', parts: parts ?? [] }];
  return (
    <div className={styles.answer}>
      {all.map((block, index) =>
        block.kind === 'paragraph' ? (
          <p key={index} className={styles.text}>
            <Parts parts={block.parts} onOpen={onOpen} />
          </p>
        ) : block.kind === 'list' ? (
          (() => {
            const List = block.ordered ? 'ol' : 'ul';
            return (
              <List key={index} className={styles.list}>
                {block.items.map((item, at) => (
                  <li key={at}>
                    <Parts parts={item} onOpen={onOpen} />
                  </li>
                ))}
              </List>
            );
          })()
        ) : (
          <div key={index} className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {block.head.map((cell, at) => (
                    <th key={at} scope="col">
                      <Parts parts={cell} onOpen={onOpen} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, at) => (
                  <tr key={at}>
                    {row.map((cell, column) => (
                      <td key={column}>
                        <Parts parts={cell} onOpen={onOpen} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}
