import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';
import styles from './Dialog.module.css';

export interface DialogProps {
  /** Whether the dialog is on screen. The caller owns this. */
  open: boolean;
  /** Called when the planner closes it: the Close button, Escape, or a click on the backdrop. */
  onClose: () => void;
  /** Says what the dialog is about. Also its accessible name. */
  title: string;
  children: ReactNode;
}

/**
 * A modal window over the screen, for reading or answering something before going back.
 * Built on the native dialog element, which keeps focus inside and returns it on close.
 */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        // A click on the dialog element itself, outside its content, is a click on the backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}
