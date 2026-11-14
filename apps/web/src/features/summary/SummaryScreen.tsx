import type { ChangeKind } from '../changes/model.ts';
import type { SlotFacts } from '../import/types.ts';
import type { TraceTarget } from '../trace/TraceView.tsx';
import { carriedNotices } from './model.ts';
import { SummaryView } from './SummaryView.tsx';
import { useSummary } from './useSummary.ts';

export interface ComparedPair {
  a: SlotFacts;
  b: SlotFacts;
}

export function SummaryScreen({
  pair,
  onBack,
  onChanges,
  onTrace,
  onHealth,
  onNarrative,
  onAudit,
  appliedEdits,
  droppedEdits,
  onUndoEdits,
}: {
  pair: ComparedPair;
  onBack: () => void;
  onChanges: (kind: ChangeKind) => void;
  onTrace: (target: TraceTarget) => void;
  onHealth: () => void;
  onNarrative: () => void;
  onAudit: () => void;
  /** Changes the planner approved that are in force. */
  appliedEdits: number;
  /** Saved changes that could not be applied when the pair was opened. */
  droppedEdits: number;
  onUndoEdits: () => void;
}) {
  const { state, retry } = useSummary();
  return (
    <SummaryView
      projectName={pair.b.projectName}
      dataDateA={pair.a.dataDate}
      dataDateB={pair.b.dataDate}
      notices={[
        ...carriedNotices(pair),
        ...(droppedEdits > 0
          ? [
              `${droppedEdits === 1 ? 'A change you approved earlier' : `${droppedEdits} changes you approved earlier`} could not be applied to these files and ${droppedEdits === 1 ? 'was' : 'were'} left out.`,
            ]
          : []),
      ]}
      // Once a change is approved, Slip's recalculated dates are the ones that describe the
      // edited schedule, so the note about the file's dates no longer applies.
      state={appliedEdits > 0 ? { ...state, recalculation: '' } : state}
      edits={appliedEdits > 0 ? { count: appliedEdits, onUndoAll: onUndoEdits } : null}
      onRetry={retry}
      onBack={onBack}
      onChanges={onChanges}
      onTrace={onTrace}
      onHealth={onHealth}
      onNarrative={onNarrative}
      onAudit={onAudit}
    />
  );
}
