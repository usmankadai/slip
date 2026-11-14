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
}: {
  pair: ComparedPair;
  onBack: () => void;
  onChanges: (kind: ChangeKind) => void;
  onTrace: (target: TraceTarget) => void;
  onHealth: () => void;
  onNarrative: () => void;
  onAudit: () => void;
}) {
  const { state, retry } = useSummary();
  return (
    <SummaryView
      projectName={pair.b.projectName}
      dataDateA={pair.a.dataDate}
      dataDateB={pair.b.dataDate}
      notices={carriedNotices(pair)}
      state={state}
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
