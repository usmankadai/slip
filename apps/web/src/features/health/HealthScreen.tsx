import { useCallback, useEffect, useRef, useState } from 'react';
import { engine } from '../../app/engine.ts';
import { EngineRequestError } from '../../workers/engineClient.ts';
import type { SlotFacts } from '../import/types.ts';
import { HealthView, type HealthState } from './HealthView.tsx';
import { compareHealth } from './model.ts';

export function HealthScreen({
  pair,
  onBack,
  onActivities,
}: {
  pair: { a: SlotFacts; b: SlotFacts };
  onBack: () => void;
  onActivities: (check: { id: number; name: string }) => void;
}) {
  const [state, setState] = useState<HealthState>({ status: 'loading' });
  const run = useRef(0);

  const load = useCallback(() => {
    const token = ++run.current;
    setState({ status: 'loading' });
    Promise.all([
      engine().request({ type: 'health', slot: 'a' }),
      engine().request({ type: 'health', slot: 'b' }),
    ]).then(
      ([a, b]) => {
        if (run.current === token)
          setState({ status: 'ready', health: compareHealth(a.checks, b.checks) });
      },
      (error: unknown) => {
        if (run.current !== token) return;
        const code = error instanceof EngineRequestError ? error.code : '';
        setState({
          status: 'error',
          message:
            code === 'crashed' || code === 'not-loaded'
              ? 'The engine stopped and the schedules are no longer loaded. Go back to import and load them again.'
              : 'Something went wrong while running the checks.',
        });
      },
    );
  }, []);

  useEffect(() => {
    load();
    return () => {
      run.current++;
    };
  }, [load]);

  return (
    <HealthView
      projectName={pair.b.projectName}
      dataDateA={pair.a.dataDate}
      dataDateB={pair.b.dataDate}
      state={state}
      onRetry={load}
      onBack={onBack}
      onActivities={onActivities}
    />
  );
}
