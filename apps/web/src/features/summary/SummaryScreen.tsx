import type { SlotFacts } from '../import/types.ts';
import { carriedNotices } from './model.ts';
import { SummaryView } from './SummaryView.tsx';
import { useSummary } from './useSummary.ts';

export interface ComparedPair {
  a: SlotFacts;
  b: SlotFacts;
}

export function SummaryScreen({ pair, onBack }: { pair: ComparedPair; onBack: () => void }) {
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
    />
  );
}
