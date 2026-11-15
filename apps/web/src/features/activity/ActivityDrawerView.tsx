import { Button, DeltaCell, Skeleton, TabBar, tabId, tabPanelId } from '@slip/ui';
import { count, plural } from '../../shared/format.ts';
import type { ActivityModel, FieldRow, LinkChange, LinkRow } from './model.ts';
import styles from './activity.module.css';

export type DrawerTab = 'changed' | 'logic' | 'everything';

export type DrawerState =
  | { status: 'loading'; code: string }
  | { status: 'error'; code: string; message: string }
  | { status: 'ready'; model: ActivityModel };

/** The sentence on why it moved, which comes from a trace and arrives after the rest. */
export type WhyState =
  { status: 'loading' } | { status: 'ready'; sentence: string | null } | { status: 'error' };

export interface ActivityDrawerViewProps {
  state: DrawerState;
  why: WhyState;
  tab: DrawerTab;
  onTab: (tab: DrawerTab) => void;
  onClose: () => void;
  onRetry: () => void;
  /** Opens the slip trace for this activity. */
  onTrace: () => void;
}

const ID = 'activity-drawer';

function Fields({ rows, isNew }: { rows: FieldRow[]; isNew: boolean }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Field</th>
          {isNew ? null : <th scope="col">Update A</th>}
          <th scope="col">Update B</th>
          {isNew ? null : (
            <th scope="col" className={styles.number}>
              Change
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className={row.changed ? styles.changed : undefined}>
            <th scope="row">{row.label}</th>
            {isNew ? null : <td>{row.was}</td>}
            <td>{row.now}</td>
            {isNew ? null : <td className={styles.number}>{row.change}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Links({ title, rows, total }: { title: string; rows: LinkRow[]; total: number }) {
  return (
    <section>
      <h3 className={styles.label}>
        {title} <span className={styles.quiet}>{count(total)} in update B</span>
      </h3>
      {rows.length === 0 ? (
        <p className={styles.say}>None.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Activity</th>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col" className={styles.number}>
                Lag
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code}>
                <td className={styles.code}>{row.code}</td>
                <td>{row.name}</td>
                <td>{row.type}</td>
                <td className={styles.number}>{row.lag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {total > rows.length ? (
        <p className={styles.quiet}>
          Showing the first {count(rows.length)}. {count(total - rows.length)} more are not listed.
        </p>
      ) : null}
    </section>
  );
}

function LogicChanges({ model }: { model: ActivityModel }) {
  const changes: LinkChange[] | null = model.linkChanges;
  if (model.isNew) {
    return (
      <p className={styles.say}>
        New in update B, so all {plural(model.predecessorCount + model.successorCount, 'link')} are
        new. They are on the Logic tab.
      </p>
    );
  }
  if (changes === null) {
    return (
      <p className={styles.say}>
        {model.logicChanged ? 'Its logic changed. ' : 'Its logic did not change. '}
        It has more links than Slip lists here, so they are not compared one by one.
      </p>
    );
  }
  if (changes.length === 0) {
    return <p className={styles.say}>No relationship was added, removed or changed.</p>;
  }
  return (
    <table className={styles.table}>
      <tbody>
        {changes.map((link) => (
          <tr
            key={`${link.side}-${link.change}-${link.code}`}
            className={link.change === 'Removed' ? styles.removed : undefined}
          >
            <td>{link.side}</td>
            <td className={styles.change}>{link.change}</td>
            <td className={styles.code}>{link.code}</td>
            <td>{link.name}</td>
            <td>
              {link.type} {link.lag}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Why({
  why,
  slipDays,
  onTrace,
}: {
  why: WhyState;
  slipDays: number | null;
  onTrace: () => void;
}) {
  const text =
    slipDays === null
      ? 'New in update B, so there is no slip to explain.'
      : why.status === 'loading'
        ? 'Tracing what drives its finish.'
        : why.status === 'error'
          ? 'Slip could not trace this activity here. The trace screen may still work.'
          : (why.sentence ?? 'Its finish did not move, so there is nothing to explain.');
  return (
    <div className={styles.why} aria-busy={why.status === 'loading'}>
      <p className={styles.say}>{text}</p>
      {slipDays !== null && slipDays !== 0 ? (
        <Button onClick={onTrace}>Open the trace</Button>
      ) : null}
    </div>
  );
}

/**
 * The activity drawer under the changes grid (exploration 10, option C): what changed first,
 * with why, and the rest on two more tabs. Presentational.
 */
export function ActivityDrawerView({
  state,
  why,
  tab,
  onTab,
  onClose,
  onRetry,
  onTrace,
}: ActivityDrawerViewProps) {
  const model = state.status === 'ready' ? state.model : null;
  const code = model ? model.code : state.status === 'ready' ? '' : state.code;
  return (
    <section className={styles.drawer} aria-label={`Activity ${code}`}>
      <header className={styles.header}>
        <h2 className={styles.name}>
          {model ? model.name || 'Activity with no name' : 'Activity'}
        </h2>
        <span className={styles.code}>{code}</span>
        {model ? (
          <span className={styles.slip}>
            {model.isNew ? (
              'New in update B'
            ) : model.slipDays === null ? null : (
              <>
                <DeltaCell days={model.slipDays} /> <span className={styles.quiet}>finish</span>
              </>
            )}
          </span>
        ) : null}
        {model?.critical ? <span className={styles.quiet}>{model.critical}</span> : null}
        <span className={styles.push}>
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
        </span>
      </header>

      {state.status === 'loading' ? (
        <div className={styles.body} aria-busy="true">
          <p className={styles.say}>Reading this activity from both updates</p>
          <Skeleton width="long" />
          <Skeleton width="medium" />
        </div>
      ) : state.status === 'error' ? (
        <div className={styles.body}>
          <p className={styles.say} role="alert">
            {state.message}
          </p>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      ) : (
        <>
          <TabBar
            label="Activity"
            idPrefix={ID}
            value={tab}
            onChange={onTab}
            tabs={[
              { value: 'changed', label: 'What changed' },
              {
                value: 'logic',
                label: 'Logic',
                note: `${count(state.model.predecessorCount)} in, ${count(state.model.successorCount)} out`,
              },
              { value: 'everything', label: 'Everything' },
            ]}
          />
          <div
            role="tabpanel"
            id={tabPanelId(ID, tab)}
            aria-labelledby={tabId(ID, tab)}
            className={styles.body}
            tabIndex={0}
          >
            {tab === 'changed' ? (
              <div className={styles.columns}>
                <section>
                  <h3 className={styles.label}>Fields</h3>
                  {state.model.isNew ? (
                    <p className={styles.say}>
                      New in update B. Its values are on the Everything tab.
                    </p>
                  ) : state.model.changedCount === 0 ? (
                    <p className={styles.say}>
                      Nothing about this activity changed between the updates.
                    </p>
                  ) : (
                    <Fields rows={state.model.fields.filter((row) => row.changed)} isNew={false} />
                  )}
                </section>
                <section>
                  <h3 className={styles.label}>Logic that changed</h3>
                  <LogicChanges model={state.model} />
                  <h3 className={styles.label}>Why it moved</h3>
                  <Why why={why} slipDays={state.model.slipDays} onTrace={onTrace} />
                </section>
              </div>
            ) : tab === 'logic' ? (
              <div className={styles.columns}>
                <Links
                  title="Predecessors"
                  rows={state.model.predecessors}
                  total={state.model.predecessorCount}
                />
                <Links
                  title="Successors"
                  rows={state.model.successors}
                  total={state.model.successorCount}
                />
              </div>
            ) : (
              <Fields rows={state.model.fields} isNew={state.model.isNew} />
            )}
          </div>
        </>
      )}
    </section>
  );
}
