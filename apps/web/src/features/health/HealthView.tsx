import { Button, Skeleton } from '@slip/ui';
import { longDate, plural } from '../../shared/format.ts';
import { healthHeadline, type CheckRow, type HealthView as Health } from './model.ts';
import styles from './health.module.css';

export type HealthState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; health: Health };

export interface HealthViewProps {
  projectName: string;
  /** Data dates of update A and update B, minutes since the epoch. */
  dataDateA: number;
  dataDateB: number;
  state: HealthState;
  onRetry: () => void;
  onBack: () => void;
  /** Opens the changes grid on the activities counted against a check in update B. */
  onActivities: (check: { id: number; name: string }) => void;
}

const MOVED: Record<string, string> = { worse: 'Worse', better: 'Better' };

function Check({
  row,
  onActivities,
}: {
  row: CheckRow;
  onActivities: HealthViewProps['onActivities'];
}) {
  const status = row.passes === null ? 'Not judged' : row.passes ? 'Passes' : 'Fails';
  return (
    <tr>
      <td className={styles.number}>{row.id}</td>
      <th scope="row">
        <span className={styles.name}>{row.name}</span>
        <span className={styles.detail}>
          {row.counts} {row.rule}.
        </span>
        {row.note ? <span className={styles.note}>{row.note}</span> : null}
      </th>
      <td className={styles.status}>
        <span
          className={`${styles.mark} ${row.passes === false ? styles.fails : row.passes ? styles.passes : styles.unjudged}`}
          aria-hidden="true"
        />
        {status}
      </td>
      <td className={styles.figure}>{row.was}</td>
      <td className={`${styles.figure} ${styles.now}`}>{row.now}</td>
      <td className={styles.change}>
        {MOVED[row.movement] ? <span className={styles.moved}>{MOVED[row.movement]}</span> : null}
        {row.change ? <span>{row.change}</span> : null}
      </td>
      <td className={styles.way}>
        {row.hasOffenders ? (
          <Button
            variant="quiet"
            aria-label={`See the activities counted against ${row.name}`}
            onClick={() => onActivities({ id: row.id, name: row.name })}
          >
            See them
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

function Checks({
  caption,
  rows,
  onActivities,
}: {
  caption: string;
  rows: CheckRow[];
  onActivities: HealthViewProps['onActivities'];
}) {
  return (
    <table className={styles.table}>
      <caption className={styles.caption}>{caption}</caption>
      <thead>
        <tr>
          <th scope="col" className={styles.number}>
            #
          </th>
          <th scope="col">Check</th>
          <th scope="col" className={styles.statusHead}>
            In update B
          </th>
          <th scope="col" className={styles.figure}>
            Update A
          </th>
          <th scope="col" className={styles.figure}>
            Update B
          </th>
          <th scope="col" className={styles.changeHead}>
            Change
          </th>
          <th scope="col" className={styles.wayHead}>
            <span className={styles.hidden}>Activities</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Check key={row.id} row={row} onActivities={onActivities} />
        ))}
      </tbody>
    </table>
  );
}

/** The health comparison, layout A: the checks that moved lead, the rest follow in DCMA order. Presentational. */
export function HealthView({
  projectName,
  dataDateA,
  dataDateB,
  state,
  onRetry,
  onBack,
  onActivities,
}: HealthViewProps) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{projectName || 'Project with no name'}</h1>
          <p className={styles.period}>
            Health · {longDate(dataDateA)} to {longDate(dataDateB)}
          </p>
        </div>
        <Button variant="quiet" onClick={onBack}>
          Back to summary
        </Button>
      </header>

      {state.status === 'loading' ? (
        <section className={`${styles.box} ${styles.lead}`} aria-busy="true">
          <h2 className={styles.answer}>Running 14 checks on each update</h2>
          <div className={styles.skeletons}>
            <Skeleton width="long" />
            <Skeleton width="medium" />
            <Skeleton width="long" />
          </div>
        </section>
      ) : state.status === 'error' ? (
        <section className={`${styles.box} ${styles.lead}`}>
          <h2 className={styles.answer}>Slip could not run the checks</h2>
          <p className={styles.say} role="alert">
            {state.message}
          </p>
          <div>
            <Button onClick={onRetry}>Try again</Button>
          </div>
        </section>
      ) : (
        <>
          <section className={`${styles.box} ${styles.lead}`}>
            <h2 className={styles.answer}>{healthHeadline(state.health)}</h2>
            {state.health.worse.length > 0 ? (
              <Checks caption="Worse" rows={state.health.worse} onActivities={onActivities} />
            ) : null}
            {state.health.better.length > 0 ? (
              <Checks caption="Better" rows={state.health.better} onActivities={onActivities} />
            ) : null}
            {state.health.worse.length === 0 && state.health.better.length === 0 ? (
              <p className={styles.say}>
                {state.health.compared === 0
                  ? 'Neither update has a check that can be judged in both.'
                  : `Every check that passed still passes, and none that fails is further from its threshold. ${plural(state.health.failing, 'check fails', 'checks fail')} in update B.`}
              </p>
            ) : null}
          </section>
          {state.health.rest.length > 0 ? (
            <section className={styles.box}>
              <Checks
                caption={
                  state.health.worse.length + state.health.better.length > 0
                    ? `The other ${plural(state.health.rest.length, 'check')}`
                    : `All ${plural(state.health.rest.length, 'check')}`
                }
                rows={state.health.rest}
                onActivities={onActivities}
              />
            </section>
          ) : null}
          <p className={styles.footnote}>
            These are the DCMA 14-point checks, run on the dates and float stored in each file. A
            check is worse if it passed and now fails, or fails in both updates and its figure is
            further from its threshold. &quot;See them&quot; shows the activities counted in update
            B; for a relationship check, the successor of each relationship.
          </p>
        </>
      )}
    </main>
  );
}
