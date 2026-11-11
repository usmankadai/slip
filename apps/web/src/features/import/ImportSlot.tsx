import { useId, useRef, useState, type DragEvent } from 'react';
import { Button, Notice, ProgressBar } from '@slip/ui';
import { count, longDate, megabytes, plural } from '../../shared/format.ts';
import { ImportReport } from './ImportReport.tsx';
import styles from './import.module.css';
import type { SlotId, SlotState } from './types.ts';

export interface SlotHandlers {
  onFile: (slot: SlotId, file: File) => void;
  onCancel: (slot: SlotId) => void;
  onRetry: (slot: SlotId) => void;
  onProject: (slot: SlotId, projectId: number) => void;
  onAcceptIncomplete: (slot: SlotId) => void;
}

const LABEL: Record<SlotId, { title: string; drop: string }> = {
  a: { title: 'Update A, earlier', drop: "Drop last month's XER file here" },
  b: { title: 'Update B, later', drop: "Drop this month's XER file here" },
};

function progressLabel(state: Extract<SlotState, { status: 'loading' }>): string {
  const size = `${megabytes(state.bytesRead)} of ${megabytes(state.totalBytes)} MB`;
  switch (state.phase) {
    case 'generating':
      return 'Generating a sample pair';
    case 'hashing':
      return `Checking for a saved copy: ${size}`;
    case 'parsing':
      return `Reading: ${plural(state.rows, 'row')} · ${size}`;
    case 'caching':
      return `Saving a copy for next time: ${plural(state.rows, 'row')}`;
    case 'loading':
      return 'Handing the schedule to the engine';
  }
}

export function ImportSlot({
  id,
  state,
  handlers,
}: {
  id: SlotId;
  state: SlotState;
  handlers: SlotHandlers;
}) {
  const input = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const [over, setOver] = useState(false);
  const label = LABEL[id];

  const choose = () => input.current?.click();
  const picker = (
    <input
      ref={input}
      className={styles.fileInput}
      type="file"
      accept=".xer"
      aria-label={`Choose a file for ${label.title}`}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) handlers.onFile(id, file);
      }}
    />
  );
  // One file dropped on a slot goes to that slot. Two or more are left for the screen to place.
  const drop = {
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (event: DragEvent) => {
      setOver(false);
      if (event.dataTransfer.files.length !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      handlers.onFile(id, event.dataTransfer.files[0]!);
    },
  };

  if (state.status === 'empty') {
    return (
      <section
        className={`${styles.slot} ${styles.slotEmpty} ${over ? styles.slotOver : ''}`}
        aria-labelledby={headingId}
        {...drop}
      >
        <h2 id={headingId} className={styles.slotLabel}>
          {label.title}
        </h2>
        <p className={styles.dropText}>{label.drop}</p>
        <Button onClick={choose}>Choose a file</Button>
        {picker}
      </section>
    );
  }

  if (state.status === 'loading') {
    const known = state.phase === 'hashing' || state.phase === 'parsing';
    return (
      <section className={styles.slot} aria-labelledby={headingId} aria-busy="true">
        <h2 id={headingId} className={styles.slotLabel}>
          {label.title}
        </h2>
        <p className={styles.fileName}>{state.fileName}</p>
        <ProgressBar
          label={progressLabel(state)}
          {...(known ? { value: state.bytesRead, max: state.totalBytes } : {})}
        />
        {state.phase === 'generating' ? null : (
          <div className={styles.slotFoot}>
            <Button variant="quiet" onClick={() => handlers.onCancel(id)}>
              Cancel
            </Button>
          </div>
        )}
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section
        className={`${styles.slot} ${styles.slotError}`}
        aria-labelledby={headingId}
        {...drop}
      >
        <h2 id={headingId} className={styles.slotLabel}>
          {label.title}
        </h2>
        <div role="alert">
          <p className={styles.errorTitle}>{state.title}</p>
          <p className={styles.errorDetail}>{state.detail}</p>
        </div>
        <div className={styles.actions}>
          {state.retry ? <Button onClick={() => handlers.onRetry(id)}>Try again</Button> : null}
          <Button onClick={choose}>Choose another file</Button>
        </div>
        {picker}
      </section>
    );
  }

  const { facts } = state;
  const needsAnswer = facts.incomplete && !facts.incompleteAccepted;
  return (
    <section
      className={`${styles.slot} ${over ? styles.slotOver : ''}`}
      aria-labelledby={headingId}
      {...drop}
    >
      <h2 id={headingId} className={styles.slotLabel}>
        {label.title}
      </h2>
      <p className={styles.project}>{facts.projectName || 'Project with no name'}</p>
      <p className={styles.facts}>
        Data date {longDate(facts.dataDate)} · {plural(facts.activities, 'activity', 'activities')}{' '}
        · {plural(facts.relationships, 'relationship')}
      </p>

      {facts.projects.length > 1 ? (
        <fieldset className={styles.projects}>
          <legend>
            This file holds {count(facts.projects.length)} projects. Choose the one to compare.
          </legend>
          {facts.projects.map((project) => (
            <label key={project.id} className={styles.projectOption}>
              <input
                type="radio"
                name={`project-${id}`}
                checked={project.id === facts.projectId}
                onChange={() => handlers.onProject(id, project.id)}
              />
              <span>{project.name || 'Project with no name'}</span>
              <span className={styles.projectDate}>{longDate(project.dataDate)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {facts.incomplete ? (
        <Notice
          tone={needsAnswer ? 'attention' : 'plain'}
          title="This file is incomplete"
          action={
            needsAnswer ? (
              <>
                <Button onClick={choose}>Choose another file</Button>
                <Button variant="quiet" onClick={() => handlers.onAcceptIncomplete(id)}>
                  Use it as it is
                </Button>
              </>
            ) : undefined
          }
        >
          It ends without the closing line P6 writes. Slip read{' '}
          {plural(facts.activities, 'activity', 'activities')} and{' '}
          {plural(facts.relationships, 'relationship')}; some are probably missing.
          {needsAnswer ? '' : ' You chose to use it as it is.'}
        </Notice>
      ) : null}

      <ImportReport report={facts.report} />

      <div className={styles.slotFoot}>
        <span className={styles.fileName}>{facts.fileName}</span>
        <Button variant="quiet" onClick={choose}>
          Replace
        </Button>
      </div>
      {picker}
    </section>
  );
}
