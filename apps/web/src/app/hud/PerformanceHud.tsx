/**
 * The performance HUD's container (performance spec; the sampling pattern is ported from pulse's
 * performance HUD). It is loaded only when first shown, and while it is hidden nothing of it runs:
 * no animation frame loop, no timers, no engine requests.
 */
import { useEffect, useRef, useState } from 'react';
import { engine } from '../engine.ts';
import { engineStats } from '../../workers/engineClient.ts';
import { FrameWindow } from './frames.ts';
import { Hud, type HudValues } from './Hud.tsx';

interface PerformanceWithMemory extends Performance {
  memory?: { usedJSHeapSize: number };
}

const SAMPLE_MS = 500;
const COUNTS_MS = 2000;

export default function PerformanceHud({ onClose }: { onClose: () => void }) {
  const frames = useRef(new FrameWindow());
  const [values, setValues] = useState<HudValues>({
    activitiesA: null,
    activitiesB: null,
    p50: null,
    p95: null,
    roundTrip: null,
    heapBytes: null,
    engineBytes: 0,
  });

  useEffect(() => {
    let frame = requestAnimationFrame(function tick(now) {
      frames.current.add(now);
      frame = requestAnimationFrame(tick);
    });
    const sample = setInterval(() => {
      const summary = frames.current.summary();
      // performance.memory is Chromium only and not in the DOM types; it is checked before use.
      const memory = (performance as PerformanceWithMemory).memory;
      setValues((previous) => ({
        ...previous,
        p50: summary?.p50 ?? null,
        p95: summary?.p95 ?? null,
        roundTrip: engineStats.lastType
          ? { type: engineStats.lastType, ms: engineStats.lastMs }
          : null,
        heapBytes: memory ? memory.usedJSHeapSize : null,
      }));
    }, SAMPLE_MS);
    // The counts change only on import or an edit, so they are asked for less often. The HUD's
    // own request is not shown as the last round trip.
    const ask = () => {
      const before = { ...engineStats };
      engine()
        .request({ type: 'info' })
        .then(
          (info) => {
            Object.assign(engineStats, before);
            setValues((previous) => ({
              ...previous,
              activitiesA: info.a?.activities ?? null,
              activitiesB: info.b?.activities ?? null,
              engineBytes: (info.a?.bytes ?? 0) + (info.b?.bytes ?? 0),
            }));
          },
          () => {},
        );
    };
    ask();
    const counts = setInterval(ask, COUNTS_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(sample);
      clearInterval(counts);
    };
  }, []);

  return <Hud values={values} onClose={onClose} />;
}
