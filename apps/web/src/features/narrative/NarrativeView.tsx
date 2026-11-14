import { Button, EntityChip, Notice, Skeleton } from '@slip/ui';
import { longDate, plural } from '../../shared/format.ts';
import { evidenceLabel, markOf, type Block, type Evidence } from './model.ts';
import styles from './narrative.module.css';

export type NarrativeState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; blocks: Block[] };

export interface NarrativeViewProps {
  projectName: string;
  dataDateA: number;
  dataDateB: number;
  state: NarrativeState;
  onChange: (id: string, text: string) => void;
  onRestore: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onExport: () => void;
  onEvidence: (evidence: Evidence) => void;
  onRetry: () => void;
  onBack: () => void;
  /** Whether the paragraphs are kept in this browser: null while not known yet. */
  saved: boolean | null;
}

const MARK_WORDS = {
  generated: 'Generated',
  edited: 'Edited by you',
  own: 'Your own statement',
} as const;

function BlockEditor({
  block,
  onChange,
  onRestore,
  onRemove,
  onEvidence,
}: {
  block: Block;
} & Pick<NarrativeViewProps, 'onChange' | 'onRestore' | 'onRemove' | 'onEvidence'>) {
  const mark = markOf(block);
  const id = `block-${block.id}`;
  return (
    <section
      className={`${styles.block} ${mark === 'generated' ? '' : styles.handled}`}
      aria-labelledby={`${id}-title`}
    >
      <div className={styles.blockHead}>
        <h2 id={`${id}-title`} className={styles.blockTitle}>
          {block.title}
        </h2>
        <span className={`${styles.mark} ${styles[mark]}`}>{MARK_WORDS[mark]}</span>
      </div>
      <label className={styles.hidden} htmlFor={id}>
        {block.title}
      </label>
      <textarea
        id={id}
        className={styles.text}
        value={block.text}
        rows={Math.max(3, Math.ceil(block.text.length / 95) + 1)}
        placeholder={block.source === 'own' ? 'Write what you want the client to know.' : ''}
        onChange={(event) => onChange(block.id, event.target.value)}
      />
      {block.evidence.length > 0 ? (
        <div className={styles.evidence}>
          <span className={styles.evidenceLabel}>Evidence</span>
          {block.evidence.map((item) => (
            <EntityChip
              key={evidenceLabel(item)}
              kind={item.type === 'activity' ? 'activity' : 'other'}
              label={evidenceLabel(item)}
              description={
                item.type === 'activity'
                  ? `Open activity ${item.code}`
                  : item.type === 'check'
                    ? `See the activities counted against ${item.name}`
                    : `See activities with ${item.label.toLowerCase()} changes`
              }
              onOpen={() => onEvidence(item)}
            />
          ))}
        </div>
      ) : null}
      {mark === 'edited' ? (
        <p className={styles.note}>
          The evidence is for the generated text. Check your wording still matches it.{' '}
          <Button variant="quiet" onClick={() => onRestore(block.id)}>
            Restore the generated text
          </Button>
        </p>
      ) : mark === 'own' ? (
        <p className={styles.note}>
          No evidence is attached. The export marks this as your own statement.{' '}
          <Button variant="quiet" onClick={() => onRemove(block.id)}>
            Remove
          </Button>
        </p>
      ) : block.evidence.length === 0 ? (
        <p className={styles.note}>Nothing to cite: this paragraph reports that nothing moved.</p>
      ) : null}
    </section>
  );
}

/** Finish update, layout B: paragraph blocks, each with its own evidence. Presentational. */
export function NarrativeView(props: NarrativeViewProps) {
  const { projectName, dataDateA, dataDateB, state, onAdd, onExport, onRetry, onBack, saved } =
    props;
  const blocks = state.status === 'ready' ? state.blocks : [];
  const marks = blocks.map(markOf);
  const tally = (mark: string) => marks.filter((m) => m === mark).length;
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{projectName || 'Project with no name'}</h1>
          <p className={styles.period}>
            Finish update · {longDate(dataDateA)} to {longDate(dataDateB)}
          </p>
        </div>
        <div className={styles.actions}>
          <Button variant="primary" disabled={state.status !== 'ready'} onClick={onExport}>
            Export as Markdown
          </Button>
          <Button variant="quiet" onClick={onBack}>
            Back to summary
          </Button>
        </div>
      </header>

      {state.status === 'loading' ? (
        <section className={styles.block} aria-busy="true">
          <p className={styles.blockTitle}>
            Writing the narrative from the summary, trace and health results
          </p>
          <div className={styles.skeletons}>
            <Skeleton width="long" />
            <Skeleton width="long" />
            <Skeleton width="medium" />
          </div>
        </section>
      ) : state.status === 'error' ? (
        <section className={styles.block}>
          <p className={styles.blockTitle}>Slip could not write the narrative</p>
          <p className={styles.say} role="alert">
            {state.message}
          </p>
          <div>
            <Button onClick={onRetry}>Try again</Button>
          </div>
        </section>
      ) : (
        <>
          <Notice>
            {plural(blocks.length, 'paragraph')}: {tally('generated')} generated, {tally('edited')}{' '}
            edited by you, {tally('own')} your own. Generated text is written from the dates stored
            in the files.{' '}
            {saved === false
              ? "This browser is not keeping Slip's data, so edits will be lost on reload."
              : 'Edits are saved in this browser as you type.'}
          </Notice>
          {blocks.map((block) => (
            <BlockEditor key={block.id} block={block} {...props} />
          ))}
          <div>
            <Button onClick={onAdd}>Add a paragraph of your own</Button>
          </div>
        </>
      )}
    </main>
  );
}
