import { Button } from '../Button/Button.tsx';
import { DeltaCell } from '../DeltaCell/DeltaCell.tsx';
import styles from './ProposedEditCard.module.css';

export interface MilestoneEffect {
  code: string;
  /** Working days the milestone's finish moves. Positive is later. */
  days: number;
}

export interface ProposedEditCardProps {
  /** "Original duration", "Constraint". */
  field: string;
  activityName: string;
  activityCode: string;
  from: string;
  to: string;
  /** The assistant's reason, as it gave it. */
  reason: string;
  /** The engine's preview; null while it is being worked out. */
  effect: {
    milestones: MilestoneEffect[];
    /** How many milestones moved in all; `milestones` may be cut short. */
    milestonesMoved: number;
    projectFinishBefore: string;
    projectFinishAfter: string;
    /** Activities whose dates the change moves. */
    activitiesMoved: number;
    /** True when the change makes the project finish later. */
    later: boolean;
  } | null;
  state: 'proposed' | 'working' | 'approved' | 'rejected' | 'undone' | 'failed';
  /** For approved, rejected, undone or failed: what happened, in a sentence. */
  outcome?: string;
  onApprove: () => void;
  onReject: () => void;
  onUndo: () => void;
  /** Opens the activities the change moves. */
  onSeeActivity?: () => void;
}

const STATE_WORDS = {
  approved: 'Approved',
  rejected: 'Rejected',
  undone: 'Undone',
  failed: 'Not applied',
} as const;

/**
 * A change the assistant proposed, for the planner to approve or reject (exploration 04,
 * option B). Nothing has changed until Approve is pressed. Presentational.
 */
export function ProposedEditCard(props: ProposedEditCardProps) {
  const { field, activityName, activityCode, from, to, reason, effect, state, outcome } = props;
  const decided = state !== 'proposed' && state !== 'working';
  return (
    <section className={styles.card} aria-label={`Proposed change to ${activityCode}`}>
      <div className={styles.kicker}>
        <span>Proposed by the assistant</span>
        {decided ? <span className={styles.state}>{STATE_WORDS[state]}</span> : null}
      </div>
      <p className={styles.subject}>
        <span className={styles.field}>{field}</span> of {activityName}{' '}
        <span className={styles.code}>{activityCode}</span>
      </p>
      <div className={styles.change} aria-label={`From ${from} to ${to}`}>
        <span className={styles.from}>{from}</span>
        <span aria-hidden="true">→</span>
        <span className={styles.to}>{to}</span>
      </div>
      <p className={styles.small}>
        <strong>Why:</strong> {reason}
      </p>
      {effect === null ? (
        <p className={styles.small}>Working out what this would move</p>
      ) : (
        <>
          {effect.later ? (
            <p className={styles.later}>This makes the project finish later.</p>
          ) : null}
          {effect.milestones.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Milestone</th>
                  <th scope="col" className={styles.moves}>
                    Finish moves
                  </th>
                </tr>
              </thead>
              <tbody>
                {effect.milestones.map((milestone) => (
                  <tr key={milestone.code}>
                    <th scope="row" className={styles.code}>
                      {milestone.code}
                    </th>
                    <td className={styles.moves}>
                      <DeltaCell days={milestone.days} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.small}>No milestone moves.</p>
          )}
          <p className={styles.small}>
            {effect.milestonesMoved > effect.milestones.length
              ? `${effect.milestonesMoved - effect.milestones.length} more milestones move. `
              : ''}
            {effect.projectFinishBefore === effect.projectFinishAfter
              ? `Project finish stays at ${effect.projectFinishAfter}.`
              : `Project finish ${effect.projectFinishBefore} → ${effect.projectFinishAfter}.`}{' '}
            {effect.activitiesMoved.toLocaleString('en-GB')}{' '}
            {effect.activitiesMoved === 1 ? 'activity changes dates.' : 'activities change dates.'}
          </p>
        </>
      )}
      {decided ? (
        <div className={styles.actions}>
          <p className={styles.small}>{outcome}</p>
          {state === 'approved' ? (
            <Button variant="quiet" onClick={props.onUndo}>
              Undo
            </Button>
          ) : null}
        </div>
      ) : (
        <div className={styles.actions}>
          <Button
            variant="primary"
            disabled={state === 'working' || effect === null}
            onClick={props.onApprove}
          >
            Approve
          </Button>
          <Button disabled={state === 'working'} onClick={props.onReject}>
            Reject
          </Button>
          {props.onSeeActivity ? (
            <Button variant="quiet" onClick={props.onSeeActivity}>
              See the activity
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
