import { ImportView } from './ImportView.tsx';
import type { SlotFacts } from './types.ts';
import { useImport } from './useImport.ts';

export function ImportScreen({
  onCompare,
}: {
  onCompare: (pair: { a: SlotFacts; b: SlotFacts }) => void;
}) {
  const { state, handlers } = useImport();
  const { a, b } = state;
  return (
    <ImportView
      state={state}
      {...handlers}
      onCompare={() => {
        if (a.status === 'ready' && b.status === 'ready') onCompare({ a: a.facts, b: b.facts });
      }}
    />
  );
}
