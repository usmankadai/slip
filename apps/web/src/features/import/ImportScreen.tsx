import { ImportView } from './ImportView.tsx';
import { useImport } from './useImport.ts';

export function ImportScreen({ onCompare }: { onCompare: () => void }) {
  const { state, handlers } = useImport();
  return <ImportView state={state} {...handlers} onCompare={onCompare} />;
}
