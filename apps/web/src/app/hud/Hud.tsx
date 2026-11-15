import { count } from '../../shared/format.ts';
import { frameText, megabytesText } from './frames.ts';
import styles from './hud.module.css';

export interface HudValues {
  /** Activities in update A and update B, or null when that update is not loaded. */
  activitiesA: number | null;
  activitiesB: number | null;
  /** Frame time over the last two seconds, in milliseconds, or null with too few frames. */
  p50: number | null;
  p95: number | null;
  /** The last request to the engine and how long it took, or null before the first. */
  roundTrip: { type: string; ms: number } | null;
  /** Main thread JS heap in bytes, or null where the browser does not say. */
  heapBytes: number | null;
  /** Bytes the two schedules hold in the engine worker. */
  engineBytes: number;
}

/** The performance HUD (Shift+P). Presentational: the numbers come from the container. */
export function Hud({ values, onClose }: { values: HudValues; onClose: () => void }) {
  const loaded = (n: number | null) => (n === null ? 'Not loaded' : count(n));
  return (
    <aside className={styles.hud} aria-label="Performance">
      <div className={styles.head}>
        <span>Performance</span>
        <button type="button" className={styles.close} onClick={onClose}>
          Hide (Shift+P)
        </button>
      </div>
      <dl className={styles.rows}>
        <dt>Activities, update A</dt>
        <dd>{loaded(values.activitiesA)}</dd>
        <dt>Activities, update B</dt>
        <dd>{loaded(values.activitiesB)}</dd>
        <dt>Frame time, p50</dt>
        <dd>{frameText(values.p50)}</dd>
        <dt>Frame time, p95</dt>
        <dd>{frameText(values.p95)}</dd>
        <dt>Last engine request</dt>
        <dd>
          {values.roundTrip
            ? `${values.roundTrip.type}, ${values.roundTrip.ms.toFixed(1)}ms`
            : 'None yet'}
        </dd>
        <dt>JS heap, page</dt>
        <dd>{megabytesText(values.heapBytes)}</dd>
        <dt>Schedules in the engine</dt>
        <dd>{megabytesText(values.engineBytes)}</dd>
      </dl>
      <p className={styles.note}>Frame times over the last 2 seconds.</p>
    </aside>
  );
}
