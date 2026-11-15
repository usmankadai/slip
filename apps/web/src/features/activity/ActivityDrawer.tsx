import { useCallback, useEffect, useRef, useState } from 'react';
import { NONE } from '@slip/xer';
import { engine } from '../../app/engine.ts';
import { EngineRequestError } from '../../workers/engineClient.ts';
import { buildTrace } from '../trace/model.ts';
import type { TraceTarget } from '../trace/TraceView.tsx';
import {
  ActivityDrawerView,
  type DrawerState,
  type DrawerTab,
  type WhyState,
} from './ActivityDrawerView.tsx';
import { activityModel, whySentence, type ActivityAnswer } from './model.ts';

/** Moving through rows with the arrow keys should not start a trace for every row passed. */
const WHY_DELAY_MS = 300;

/** The activity drawer for one activity (a container: it asks the engine). */
export function ActivityDrawer({
  code,
  onClose,
  onTrace,
}: {
  code: string;
  onClose: () => void;
  onTrace: (target: TraceTarget) => void;
}) {
  const [state, setState] = useState<DrawerState>({ status: 'loading', code });
  const [why, setWhy] = useState<WhyState>({ status: 'loading' });
  const [tab, setTab] = useState<DrawerTab>('changed');
  const answer = useRef<ActivityAnswer | null>(null);
  const run = useRef(0);

  const load = useCallback(() => {
    const token = ++run.current;
    answer.current = null;
    setState({ status: 'loading', code });
    setWhy({ status: 'loading' });
    Promise.all([
      engine().request({ type: 'activity', taskCode: code }),
      engine()
        .request({ type: 'info' })
        .catch(() => null),
    ]).then(
      ([found, info]) => {
        if (run.current !== token) return;
        const names = info?.b?.calendarNames ?? [];
        const model = activityModel(found, (index) => names[index] ?? '');
        if (!model) {
          setState({
            status: 'error',
            code,
            message: 'This activity is not in update B, so there is nothing to show for it.',
          });
          return;
        }
        answer.current = found;
        setState({ status: 'ready', model });
      },
      (error: unknown) => {
        if (run.current !== token) return;
        const kind = error instanceof EngineRequestError ? error.code : '';
        setState({
          status: 'error',
          code,
          message:
            kind === 'crashed' || kind === 'not-loaded'
              ? 'The engine stopped and the schedules are no longer loaded. Go back to import and load them again.'
              : 'Slip could not read this activity.',
        });
      },
    );

    // Why it moved: a trace, started a moment later and dropped if the selection moves on.
    const timer = setTimeout(() => {
      engine()
        .request({ type: 'trace', taskCode: code })
        .then(
          (trace) => {
            if (run.current !== token) return;
            if (trace.slipMinutes === NONE) {
              setWhy({ status: 'ready', sentence: null });
              return;
            }
            const view = buildTrace({
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
            });
            setWhy({ status: 'ready', sentence: whySentence(view, code) });
          },
          () => {
            if (run.current === token) setWhy({ status: 'error' });
          },
        );
    }, WHY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [code]);

  useEffect(() => {
    const cancel = load();
    return () => {
      cancel();
      run.current++;
    };
  }, [load]);

  const trace = () => {
    const found = answer.current;
    if (!found?.current) return;
    onTrace({
      code: found.current.taskCode,
      name: found.current.name,
      was: found.previous?.finish ?? NONE,
      now: found.current.finish,
    });
  };

  return (
    <ActivityDrawerView
      state={state}
      why={why}
      tab={tab}
      onTab={setTab}
      onClose={onClose}
      onRetry={() => void load()}
      onTrace={trace}
    />
  );
}
