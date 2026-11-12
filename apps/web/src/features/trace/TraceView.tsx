import { useState } from 'react';
import { Button, Notice, Skeleton, formatDelta } from '@slip/ui';
import { count, longDate, plural } from '../../shared/format.ts';
import {
  MINOR_DAYS,
  passedOnSentence,
  type Cause,
  type PathStep,
  type TraceView as Trace,
} from './model.ts';
import styles from './trace.module.css';

export interface TraceTarget {
  code: string;
  name: string;
  /** Finish in update A and update B, minutes since the epoch. */
  was: number;
  now: number;
}

export type TraceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  /** The activity is new in update B, so there is no earlier finish to compare with. */
  | { status: 'new' }
  | { status: 'ready'; trace: Trace };

export interface TraceViewProps {
  projectName: string;
  target: TraceTarget;
  state: TraceState;
  /** Where Back leads: "summary" or "changes". */
  backLabel: string;
  onBack: () => void;
  onRetry: () => void;
}

function CauseRow({ cause, rank, scale }: { cause: Cause; rank: number; scale: number }) {
  const width = `${(Math.abs(cause.days) / scale) * 100}%`;
  return (
    <tr>
      <td className={styles.rank}>{rank}</td>
      <th scope="row">
        <span className={styles.name}>{cause.name}</span>{' '}
        <span className={styles.code}>{cause.code}</span>
      </th>
      <td>
        {cause.what.map((word) => (
          <span key={word} className={styles.kind}>
            {word}
          </span>
        ))}
      </td>
      <td className={styles.barCell}>
        <span className={styles.bar} aria-hidden="true">
          <span className={cause.days > 0 ? styles.late : styles.early} style={{ width }} />
        </span>
      </td>
      <td className={styles.days}>{formatDelta(cause.days)}</td>
      <td className={styles.share}>
        {cause.share === null ? '' : `${Math.round(cause.share * 100)}%`}
      </td>
    </tr>
  );
}

function Step({ step, scale }: { step: PathStep; scale: number }) {
  if (step.kind === 'passed') {
    return (
      <li className={styles.passed}>
        {plural(step.passed, 'activity', 'activities')} passed it on unchanged
      </li>
    );
  }
  const part = (days: number) => `${(Math.abs(days) / scale) * 100}%`;
  // What it arrived with, then what it added. A recovery is drawn inside what it arrived with.
  const inherited = step.inherited ?? 0;
  const grey = step.own < 0 ? inherited + step.own : inherited;
  return (
    <li className={`${styles.step} ${step.target ? styles.target : ''}`}>
      <span
        className={`${styles.dot} ${step.target ? styles.dotTarget : step.own > 0 ? styles.dotLate : step.own < 0 ? styles.dotEarly : ''}`}
        aria-hidden="true"
      />
      <span className={styles.stepName}>
        <span className={styles.name}>{step.name}</span>{' '}
        <span className={styles.code}>{step.code}</span>
        {step.stops ? <span className={styles.stops}>{step.stops}</span> : null}
      </span>
      <span>
        {step.what.map((word) => (
          <span key={word} className={styles.kind}>
            {word}
          </span>
        ))}
      </span>
      <span className={styles.bar} aria-hidden="true">
        {grey > 0 ? <span className={styles.inherited} style={{ width: part(grey) }} /> : null}
        {step.own !== 0 ? (
          <span
            className={step.own > 0 ? styles.late : styles.early}
            style={{ width: part(step.own) }}
          />
        ) : null}
      </span>
      <span className={styles.days}>
        {step.target ? formatDelta(inherited) : step.own !== 0 ? formatDelta(step.own) : ''}
      </span>
    </li>
  );
}

function Ready({ trace }: { trace: Trace }) {
  const [showMinor, setShowMinor] = useState(false);
  const [showPath, setShowPath] = useState(false);
  const listed = showMinor ? [...trace.causes, ...trace.minor] : trace.causes;
  const scale = Math.max(...listed.map((cause) => Math.abs(cause.days)), 1);
  const activities = trace.path.reduce(
    (sum, step) => sum + (step.kind === 'passed' ? step.passed : 1),
    0,
  );

  if (trace.causes.length === 0) {
    return (
      <section className={`${styles.box} ${styles.lead}`}>
        <p className={styles.say}>
          {Math.abs(trace.slipDays) < 0.05
            ? 'This activity finishes when it did in the last update. There is no slip to explain.'
            : 'Slip found no activity on the driving path that added to this slip.'}
          {trace.unexplained ? ` ${formatDelta(trace.unexplained)} is not explained.` : ''}
        </p>
      </section>
    );
  }

  return (
    <>
      {trace.truncated ? (
        <Notice>
          The trace reached its size limit. The driving path goes further back than is shown, so
          some causes may be missing.
        </Notice>
      ) : null}
      <section className={`${styles.box} ${styles.lead}`} aria-label="Causes">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.rank}>
                <span className={styles.hidden}>Rank</span>
              </th>
              <th scope="col">Cause</th>
              <th scope="col">What happened</th>
              <th scope="col">Added of its own</th>
              <th scope="col" className={styles.days}>
                Days
              </th>
              <th scope="col" className={styles.share}>
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {listed.map((cause, index) => (
              <CauseRow key={cause.activity} cause={cause} rank={index + 1} scale={scale} />
            ))}
          </tbody>
        </table>
        {trace.minor.length > 0 ? (
          <p className={styles.foot}>
            {showMinor
              ? `Including ${plural(trace.minor.length, 'activity', 'activities')} under ${MINOR_DAYS} days each.`
              : `${plural(trace.minor.length, 'more activity', 'more activities')}, each under ${MINOR_DAYS} days, ${formatDelta(trace.minorDays)} in all.`}{' '}
            <Button
              variant="quiet"
              aria-expanded={showMinor}
              onClick={() => setShowMinor(!showMinor)}
            >
              {showMinor ? 'Hide them' : 'Show them'}
            </Button>
          </p>
        ) : null}
        <p className={styles.foot}>
          Share is each cause&apos;s part of the slip that was added.
          {trace.unexplained
            ? ` ${formatDelta(trace.unexplained)} of the slip is not explained by these activities.`
            : ''}
        </p>
      </section>

      <section className={styles.box} aria-label="Driving path">
        <div className={styles.pathHead}>
          <p className={styles.say}>
            {passedOnSentence(trace)} {trace.begins}
          </p>
          <Button aria-expanded={showPath} onClick={() => setShowPath(!showPath)}>
            {showPath ? 'Hide the driving path' : 'Show the driving path'}
          </Button>
        </div>
        {showPath ? (
          <>
            <p className={styles.legend}>
              {count(activities)} activities, furthest back first. Grey is the slip an activity
              arrived with; the coloured piece is what it added or recovered.
            </p>
            <ol className={styles.path}>
              {trace.path.map((step, index) => (
                <Step key={index} step={step} scale={trace.pathScale} />
              ))}
            </ol>
          </>
        ) : null}
      </section>
    </>
  );
}

/** The slip trace: ranked causes lead, the driving path sits beneath as the evidence. Presentational. */
export function TraceView({
  projectName,
  target,
  state,
  backLabel,
  onBack,
  onRetry,
}: TraceViewProps) {
  const slip = state.status === 'ready' ? state.trace.slipDays : null;
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <p className={styles.period}>{projectName || 'Project with no name'} · Slip trace</p>
          <h1 className={styles.title}>
            {target.name || 'Activity with no name'}{' '}
            <span className={styles.titleCode}>{target.code}</span>
            {slip !== null && Math.abs(slip) >= 0.05
              ? ` finishes ${formatDelta(slip)} ${slip > 0 ? 'later' : 'earlier'}`
              : ''}
          </h1>
          <p className={styles.period}>
            {longDate(target.was)} to {longDate(target.now)}
          </p>
        </div>
        <Button variant="quiet" onClick={onBack}>
          Back to {backLabel}
        </Button>
      </header>

      {state.status === 'loading' ? (
        <section className={`${styles.box} ${styles.lead}`} aria-busy="true">
          <p className={styles.say}>Walking back along the driving path</p>
          <div className={styles.skeletons}>
            <Skeleton width="long" />
            <Skeleton width="medium" />
            <Skeleton width="long" />
          </div>
        </section>
      ) : state.status === 'error' ? (
        <section className={`${styles.box} ${styles.lead}`}>
          <p className={styles.answer}>Slip could not trace this activity</p>
          <p className={styles.say} role="alert">
            {state.message}
          </p>
          <div className={styles.actions}>
            <Button onClick={onRetry}>Try again</Button>
          </div>
        </section>
      ) : state.status === 'new' ? (
        <section className={`${styles.box} ${styles.lead}`}>
          <p className={styles.answer}>This activity is new in update B</p>
          <p className={styles.say}>
            It has no finish in update A to compare with, so there is no slip to trace.
          </p>
        </section>
      ) : (
        <Ready trace={state.trace} />
      )}
    </main>
  );
}
