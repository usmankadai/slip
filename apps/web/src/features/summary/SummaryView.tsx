import { Button, DeltaCell, Notice, Skeleton } from '@slip/ui';
import { count, longDate, plural } from '../../shared/format.ts';
import type { ChangeKind } from '../changes/model.ts';
import type { TraceTarget } from '../trace/TraceView.tsx';
import {
  changeLines,
  criticalSentence,
  healthSentence,
  milestoneHeading,
  nothingChanged,
  type ChangeCounts,
  type Loadable,
  type MilestoneList,
  type SummaryState,
} from './model.ts';
import styles from './summary.module.css';

export interface SummaryViewProps {
  projectName: string;
  /** Data dates of update A and update B, minutes since the epoch. */
  dataDateA: number;
  dataDateB: number;
  /** Lines about the files that make the numbers below less trustworthy. */
  notices: string[];
  state: SummaryState;
  onRetry: () => void;
  onBack: () => void;
  /** Opens the changes grid on a kind of change. */
  onChanges: (kind: ChangeKind) => void;
  /** Opens the slip trace for a milestone. */
  onTrace: (target: TraceTarget) => void;
  /** Opens the health comparison. */
  onHealth: () => void;
}

function Milestones({
  milestones,
  changes,
  latestFinish,
  onRetry,
  onBack,
  onTrace,
}: {
  milestones: Loadable<MilestoneList>;
  changes: Loadable<ChangeCounts>;
  latestFinish: string;
  onRetry: () => void;
  onBack: () => void;
  onTrace: (target: TraceTarget) => void;
}) {
  if (milestones.status === 'loading') {
    return (
      <section className={`${styles.box} ${styles.lead}`} aria-busy="true">
        <h2 className={styles.answer}>Finding the milestones that moved</h2>
        <div className={styles.skeletons}>
          <Skeleton width="long" />
          <Skeleton width="medium" />
          <Skeleton width="long" />
        </div>
      </section>
    );
  }
  if (milestones.status === 'error') {
    return (
      <section className={`${styles.box} ${styles.lead}`}>
        <h2 className={styles.answer}>Slip could not compare the milestones</h2>
        <p className={styles.say} role="alert">
          {milestones.message}
        </p>
        <div className={styles.actions}>
          <Button onClick={onRetry}>Try again</Button>
          <Button variant="quiet" onClick={onBack}>
            Back to import
          </Button>
        </div>
      </section>
    );
  }

  const list = milestones.value;
  const counts = changes.status === 'ready' ? changes.value : null;
  if (counts && nothingChanged(counts)) {
    return (
      <section className={`${styles.box} ${styles.lead}`}>
        <h2 className={styles.answer}>Nothing changed between these updates</h2>
        <p className={styles.say}>
          Every activity has the same dates, durations and logic in both. If that is not what you
          expected, check that update B is this month&apos;s file.
        </p>
        <div className={styles.actions}>
          <Button onClick={onBack}>Back to import</Button>
        </div>
      </section>
    );
  }
  if (list.total === 0 || list.moved === 0) {
    return (
      <section className={`${styles.box} ${styles.lead}`}>
        <h2 className={styles.answer}>{milestoneHeading(list)}</h2>
        <p className={styles.say}>
          {list.total === 0
            ? `Slip leads with milestones, and there are none in update B. ${latestFinish}`
            : `All ${plural(list.total, 'milestone')} finish when they did in the last update.${
                counts ? ` ${plural(counts.datesMoved, 'activity', 'activities')} did move.` : ''
              }`}
        </p>
      </section>
    );
  }

  const unmoved = list.total - list.moved;
  return (
    <section className={`${styles.box} ${styles.lead}`}>
      <h2 className={styles.answer}>{milestoneHeading(list)}</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Milestone</th>
            <th scope="col" className={styles.date}>
              Was
            </th>
            <th scope="col" className={styles.date}>
              Now
            </th>
            <th scope="col" className={styles.slipHead}>
              Finish slip
            </th>
            <th scope="col">
              <span className={styles.hidden}>Trace</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.rows.map((row) => (
            <tr key={row.code}>
              <th scope="row">
                <span className={styles.name}>{row.name}</span>{' '}
                <span className={styles.code}>{row.code}</span>
                <span className={styles.fold}>
                  {longDate(row.was)} to {longDate(row.now)}
                </span>
              </th>
              <td className={styles.date}>{longDate(row.was)}</td>
              <td className={styles.date}>{longDate(row.now)}</td>
              <td className={styles.slip}>
                <DeltaCell days={row.days} />
              </td>
              <td className={styles.traceCell}>
                <Button
                  variant="quiet"
                  aria-label={`Trace ${row.name}`}
                  onClick={() =>
                    onTrace({ code: row.code, name: row.name, was: row.was, now: row.now })
                  }
                >
                  Trace
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.foot}>
        {list.moved > list.rows.length
          ? `Showing the ${count(list.rows.length)} largest moves of ${count(list.moved)}. `
          : ''}
        {unmoved > 0 ? `${plural(unmoved, 'milestone')} did not move.` : ''}
      </p>
    </section>
  );
}

function RailBox<T>({
  title,
  busy,
  part,
  children,
}: {
  title: string;
  busy: string;
  part: Loadable<T>;
  children: (value: T) => React.ReactNode;
}) {
  return (
    <section className={styles.box} aria-busy={part.status === 'loading'}>
      <h2 className={styles.boxTitle}>{title}</h2>
      {part.status === 'loading' ? (
        <>
          <p className={styles.quiet}>{busy}</p>
          <Skeleton width="medium" />
        </>
      ) : part.status === 'error' ? (
        <p className={styles.quiet} role="alert">
          {part.message}
        </p>
      ) : (
        children(part.value)
      )}
    </section>
  );
}

/** The update summary, layout B: milestones lead, the rest sits in a rail. Presentational. */
export function SummaryView({
  projectName,
  dataDateA,
  dataDateB,
  notices,
  state,
  onRetry,
  onBack,
  onChanges,
  onTrace,
  onHealth,
}: SummaryViewProps) {
  const all = state.recalculation ? [...notices, state.recalculation] : notices;
  const empty = state.changes.status === 'ready' && nothingChanged(state.changes.value);
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{projectName || 'Project with no name'}</h1>
          <p className={styles.period}>
            Update summary · {longDate(dataDateA)} to {longDate(dataDateB)}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button onClick={() => onChanges('all')}>See all changes</Button>
          <Button variant="quiet" onClick={onBack}>
            Back to import
          </Button>
        </div>
      </header>

      {all.map((notice) => (
        <Notice key={notice}>{notice}</Notice>
      ))}

      <div className={empty ? styles.single : styles.columns}>
        <Milestones
          milestones={state.milestones}
          changes={state.changes}
          latestFinish={state.latestFinish}
          onRetry={onRetry}
          onBack={onBack}
          onTrace={onTrace}
        />
        {empty ? null : (
          <div className={styles.rail}>
            <RailBox title="Critical path" busy="Comparing the critical path" part={state.changes}>
              {(value) => <p className={styles.say}>{criticalSentence(value)}</p>}
            </RailBox>
            <RailBox title="What changed" busy="Counting the changes" part={state.changes}>
              {(value) => (
                <>
                  <dl className={styles.lines}>
                    {changeLines(value).map((line) => (
                      <div key={line.label}>
                        <dt>
                          {line.kind && line.value > 0 ? (
                            <button
                              type="button"
                              className={styles.lineLink}
                              onClick={() => onChanges(line.kind!)}
                            >
                              {line.label}
                            </button>
                          ) : (
                            line.label
                          )}
                        </dt>
                        <dd>{count(line.value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className={styles.quiet}>
                    of {plural(value.activities, 'activity', 'activities')} in update B. An activity
                    can be in more than one line.
                  </p>
                </>
              )}
            </RailBox>
            <RailBox title="Health" busy="Running 14 checks on each update" part={state.health}>
              {(value) => (
                <>
                  <p className={styles.say}>{healthSentence(value)}</p>
                  <div>
                    <Button onClick={onHealth}>See all 14 checks</Button>
                  </div>
                </>
              )}
            </RailBox>
          </div>
        )}
      </div>
    </main>
  );
}
