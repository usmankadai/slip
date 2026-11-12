import { useCallback, useEffect, useRef, useState } from 'react';
import { NONE } from '@slip/xer';
import { engine } from '../../app/engine.ts';
import { EngineRequestError } from '../../workers/engineClient.ts';
import { buildTrace } from './model.ts';
import { TraceView, type TraceState, type TraceTarget } from './TraceView.tsx';

export function TraceScreen({
  projectName,
  target,
  backLabel,
  onBack,
}: {
  projectName: string;
  target: TraceTarget;
  backLabel: string;
  onBack: () => void;
}) {
  const [state, setState] = useState<TraceState>({ status: 'loading' });
  const run = useRef(0);

  const load = useCallback(() => {
    const token = ++run.current;
    setState({ status: 'loading' });
    engine()
      .request({ type: 'trace', taskCode: target.code })
      .then(
        (trace) => {
          if (run.current !== token) return;
          if (trace.slipMinutes === NONE) {
            setState({ status: 'new' });
            return;
          }
          setState({
            status: 'ready',
            trace: buildTrace({
              slipWorkingDays: trace.slipWorkingDays,
              isNew: false,
              nodes: trace.nodes,
              depth: trace.depth,
              end: trace.end,
              codes: trace.codes,
              names: trace.names,
              slipDays: trace.slipDays,
              contributors: trace.contributors,
              truncated: trace.truncated,
            }),
          });
        },
        (error: unknown) => {
          if (run.current !== token) return;
          const code = error instanceof EngineRequestError ? error.code : '';
          setState({
            status: 'error',
            message:
              code === 'crashed' || code === 'not-loaded'
                ? 'The engine stopped and the schedules are no longer loaded. Go back to import and load them again.'
                : code === 'out-of-memory'
                  ? 'There was not enough memory to trace this activity. Closing other tabs may help.'
                  : 'Something went wrong while tracing this activity.',
          });
        },
      );
  }, [target.code]);

  useEffect(() => {
    load();
    return () => {
      run.current++;
    };
  }, [load]);

  return (
    <TraceView
      projectName={projectName}
      target={target}
      state={state}
      backLabel={backLabel}
      onBack={onBack}
      onRetry={load}
    />
  );
}
