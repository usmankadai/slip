import type { ChangeKind } from '../changes/model.ts';
import type { SlotFacts } from '../import/types.ts';
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
}: {
  pair: ComparedPair;
  onBack: () => void;
  onChanges: (kind: ChangeKind) => void;
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
    />
  );
}
