/**
 * Approving, rejecting and undoing changes to update B. Every approved change is
 * applied in the engine, saved for the pair and written to the audit log; it is
 * replayed when the pair is opened again (persistence spec).
 */
import { useCallback, useRef, useState } from 'react';
import type { Proposal } from '@slip/agent/run';
import { longDate } from '../shared/format.ts';
import type { AuditType } from '../storage/auditLog.ts';
import { loadEdits, saveEdits, type SavedEdit } from '../storage/editStore.ts';
import { engine } from './engine.ts';

export interface EditsController {
  /** Goes up whenever the schedule changes, so screens read it again. */
  version: number;
  /** Changes in force for this pair. */
  count: number;
  approve: (proposal: Proposal) => Promise<{ id: string; outcome: string }>;
  reject: (proposal: Proposal) => void;
  undo: (id: string) => Promise<string>;
  undoAll: () => Promise<void>;
}

export function useEdits(key: string, audit: (type: AuditType, summary: string) => void) {
  const [version, setVersion] = useState(0);
  const saved = useRef<SavedEdit[]>([]);
  const [count, setCount] = useState(0);

  const store = useCallback(
    (edits: SavedEdit[]) => {
      saved.current = edits;
      setCount(edits.length);
      setVersion((value) => value + 1);
      if (key) void saveEdits(key, edits);
    },
    [key],
  );

  /** Applies the edits saved for a pair. Call once its schedules are in the engine. */
  const replay = useCallback(async (pair: string): Promise<number> => {
    const edits = await loadEdits(pair);
    const kept: SavedEdit[] = [];
    for (const edit of edits) {
      try {
        await engine().request({
          type: 'applyEdit',
          taskCode: edit.taskCode,
          field: edit.field,
          to: edit.to,
          ...(edit.and ? { and: edit.and } : {}),
          id: edit.id,
        });
        kept.push(edit);
      } catch {
        // The activity is gone or the value no longer fits: the edit is dropped, and said below.
      }
    }
    saved.current = kept;
    setCount(kept.length);
    setVersion((value) => value + 1);
    return edits.length - kept.length;
  }, []);

  const approve = useCallback(
    async (proposal: Proposal) => {
      const result = await engine().request({
        type: 'applyEdit',
        taskCode: proposal.taskCode,
        field: proposal.field,
        to: proposal.to,
        ...(proposal.also ? { and: proposal.also } : {}),
      });
      store([
        ...saved.current,
        {
          id: result.edit.id,
          taskCode: proposal.taskCode,
          field: proposal.field,
          to: proposal.to,
          ...(proposal.also ? { and: proposal.also } : {}),
          reason: proposal.reason.slice(0, 300),
        },
      ]);
      const finish =
        result.projectFinishBefore === result.projectFinishAfter
          ? `The project finish stays at ${longDate(result.projectFinishAfter)}.`
          : `The project finish moved from ${longDate(result.projectFinishBefore)} to ${longDate(result.projectFinishAfter)}.`;
      audit('edit-approved', `Approved the assistant's change to ${proposal.taskCode}. ${finish}`);
      return {
        id: result.edit.id,
        outcome: `Approved by you. The schedule was recalculated. ${finish}`,
      };
    },
    [audit, store],
  );

  const reject = useCallback(
    (proposal: Proposal) =>
      audit(
        'edit-rejected',
        `Rejected the assistant's change to ${proposal.taskCode}. Nothing was changed.`,
      ),
    [audit],
  );

  const undo = useCallback(
    async (id: string) => {
      const edit = saved.current.find((item) => item.id === id);
      const result = await engine().request({ type: 'revertEdit', editId: id });
      store(saved.current.filter((item) => item.id !== id));
      audit('edit-undone', `Undid the change to ${edit?.taskCode ?? 'an activity'}.`);
      return `Undone by you. The project finish is back to ${longDate(result.projectFinishAfter)}.`;
    },
    [audit, store],
  );

  const undoAll = useCallback(async () => {
    for (const edit of [...saved.current].reverse()) {
      try {
        await engine().request({ type: 'revertEdit', editId: edit.id });
      } catch {
        // Already gone from the engine.
      }
    }
    const n = saved.current.length;
    store([]);
    audit(
      'edit-undone',
      n === 1 ? 'Undid the approved change.' : `Undid all ${n} approved changes.`,
    );
  }, [audit, store]);

  return { version, count, approve, reject, undo, undoAll, replay };
}
