import { useEffect, useState } from 'react';
import type { Proposal } from '@slip/agent/run';
import { ProposedEditCard, type ProposedEditCardProps } from '@slip/ui';
import { ConstraintType, NONE } from '@slip/xer';
import { engine } from '../../app/engine.ts';
import type { EditsController } from '../../app/useEdits.ts';
import { longDate } from '../../shared/format.ts';

const FIELD_WORDS = {
  originalDuration: 'Original duration',
  remainingDuration: 'Remaining duration',
  constraintType: 'Constraint',
  constraintDate: 'Constraint date',
} as const;

const CONSTRAINT_WORDS: Record<number, string> = {
  [ConstraintType.None]: 'None',
  [ConstraintType.StartOn]: 'Start on',
  [ConstraintType.StartOnOrAfter]: 'Start on or after',
  [ConstraintType.StartOnOrBefore]: 'Start on or before',
  [ConstraintType.FinishOn]: 'Finish on',
  [ConstraintType.FinishOnOrAfter]: 'Finish on or after',
  [ConstraintType.FinishOnOrBefore]: 'Finish on or before',
  [ConstraintType.MandatoryStart]: 'Mandatory start',
  [ConstraintType.MandatoryFinish]: 'Mandatory finish',
  [ConstraintType.AsLateAsPossible]: 'As late as possible',
};

function value(proposal: Proposal, which: 'from' | 'to', dayMinutes: number): string {
  const raw = proposal[which];
  if (proposal.field === 'constraintType') {
    const words = CONSTRAINT_WORDS[raw] ?? 'Unknown';
    const date =
      which === 'to' && proposal.also && proposal.also.to !== NONE
        ? ` ${longDate(proposal.also.to)}`
        : '';
    return `${words}${date}`;
  }
  if (proposal.field === 'constraintDate') return longDate(raw);
  const days = Math.round((raw / dayMinutes) * 10) / 10;
  return `${days.toLocaleString('en-GB')} working ${days === 1 ? 'day' : 'days'}`;
}

export interface ProposalState {
  state: 'proposed' | 'working' | 'approved' | 'rejected' | 'undone' | 'failed';
  editId?: string;
  outcome?: string;
}

/** A proposal in an answer: the engine's preview of its effect, and the planner's decision. */
export function ProposalView({
  proposal,
  edits,
  decision,
  onDecision,
  onSeeActivity,
}: {
  proposal: Proposal;
  edits: EditsController;
  decision: ProposalState;
  onDecision: (state: ProposalState) => void;
  onSeeActivity: (code: string) => void;
}) {
  const [effect, setEffect] = useState<ProposedEditCardProps['effect']>(null);
  const [name, setName] = useState('');
  const [dayMinutes, setDayMinutes] = useState(480);

  // Worked out again whenever the schedule changes, so the effect is never stale.
  useEffect(() => {
    if (decision.state !== 'proposed') return;
    let current = true;
    setEffect(null);
    void (async () => {
      try {
        const detail = await engine().request({ type: 'activity', taskCode: proposal.taskCode });
        if (!current) return;
        setName(detail.current?.name ?? '');
        setDayMinutes(detail.current?.dayMinutes || 480);
        const preview = await engine().request({
          type: 'applyEdit',
          taskCode: proposal.taskCode,
          field: proposal.field,
          to: proposal.to,
          ...(proposal.also ? { and: proposal.also } : {}),
          preview: true,
        });
        if (!current) return;
        setEffect({
          milestones: preview.milestones
            .slice(0, 6)
            .map((move) => ({ code: move.taskCode, days: move.workingDays })),
          milestonesMoved: preview.milestones.length,
          projectFinishBefore: longDate(preview.projectFinishBefore),
          projectFinishAfter: longDate(preview.projectFinishAfter),
          activitiesMoved: preview.changed.length,
          later: preview.projectFinishAfter > preview.projectFinishBefore,
        });
      } catch {
        if (current)
          onDecision({
            state: 'failed',
            outcome:
              'Slip could not work out this change for the current schedule, so it cannot be approved.',
          });
      }
    })();
    return () => {
      current = false;
    };
    // Recalculated when the schedule changes or the decision does, not on every render.
  }, [edits.version, decision.state]);

  return (
    <ProposedEditCard
      field={FIELD_WORDS[proposal.field]}
      activityName={name || proposal.taskCode}
      activityCode={proposal.taskCode}
      from={value(proposal, 'from', dayMinutes)}
      to={value(proposal, 'to', dayMinutes)}
      reason={proposal.reason}
      effect={effect}
      state={decision.state}
      outcome={decision.outcome}
      onApprove={() => {
        onDecision({ state: 'working' });
        edits.approve(proposal).then(
          ({ id, outcome }) => onDecision({ state: 'approved', editId: id, outcome }),
          () =>
            onDecision({
              state: 'failed',
              outcome: 'Slip could not apply this change. Nothing was changed.',
            }),
        );
      }}
      onReject={() => {
        edits.reject(proposal);
        onDecision({ state: 'rejected', outcome: 'Rejected by you. Nothing was changed.' });
      }}
      onUndo={() => {
        if (!decision.editId) return;
        edits.undo(decision.editId).then(
          (outcome) => onDecision({ state: 'undone', outcome }),
          () => onDecision({ ...decision, outcome: 'Slip could not undo this change.' }),
        );
      }}
      onSeeActivity={() => onSeeActivity(proposal.taskCode)}
    />
  );
}
