import { useEffect, useRef, useState, type FormEvent } from 'react';
import { splitCitations } from '@slip/agent';
import { AgentSteps, AgentText, Button, Notice, ScriptedBadge } from '@slip/ui';
import type { EditsController } from '../../app/useEdits.ts';
import type { Answer } from './loop.ts';
import { ProposalView, type ProposalState } from './ProposalView.tsx';
import type { SuggestedQuestion } from './scripted.ts';
import styles from './agent.module.css';

export interface AgentPanelProps {
  answers: readonly Answer[];
  suggested: readonly SuggestedQuestion[];
  /** True when answers are canned. */
  scripted: boolean;
  working: boolean;
  onAsk: (question: string) => void;
  onStop: () => void;
  onOpenActivity: (code: string) => void;
  onClose: () => void;
  edits: EditsController;
  /** The planner's decision on each proposal, by answer and proposal number. */
  decisions: Record<string, ProposalState>;
  onDecision: (key: string, state: ProposalState) => void;
}

function AnswerView({
  answer,
  index,
  onOpenActivity,
  edits,
  decisions,
  onDecision,
}: {
  answer: Answer;
  index: number;
  onOpenActivity: (code: string) => void;
  edits: EditsController;
  decisions: Record<string, ProposalState>;
  onDecision: (key: string, state: ProposalState) => void;
}) {
  const parts = splitCitations(answer.text, new Set(answer.known));
  const unverified = parts.filter((part) => part.kind === 'unverified').length;
  return (
    <li className={styles.turn}>
      <p className={styles.question}>{answer.question}</p>
      <div className={styles.answer}>
        <AgentSteps
          steps={answer.steps}
          working={answer.status === 'working'}
          seconds={answer.elapsedMs / 1000}
        />
        {answer.text ? <AgentText parts={parts} onOpen={onOpenActivity} /> : null}
        {answer.status === 'working' && !answer.text ? (
          <p className={styles.quiet}>Looking at the schedule</p>
        ) : null}
        {answer.status === 'error' ? (
          <Notice tone="attention">{answer.error || 'The assistant could not answer.'}</Notice>
        ) : null}
        {answer.status === 'stopped' ? <p className={styles.quiet}>Stopped.</p> : null}
        {unverified > 0 && answer.status === 'done' ? (
          <p className={styles.quiet}>
            {unverified === 1 ? 'One activity code' : `${unverified} activity codes`} in this answer
            {unverified === 1 ? ' was' : ' were'} not in what the assistant looked at, so{' '}
            {unverified === 1 ? 'it is' : 'they are'} marked unverified.
          </p>
        ) : null}
        {answer.status === 'done'
          ? answer.proposals.map((proposal, number) => {
              const key = `${index}:${number}`;
              return (
                <ProposalView
                  key={key}
                  proposal={proposal}
                  edits={edits}
                  decision={decisions[key] ?? { state: 'proposed' }}
                  onDecision={(state) => onDecision(key, state)}
                  onSeeActivity={onOpenActivity}
                />
              );
            })
          : null}
        {answer.scripted && answer.status !== 'working' ? <ScriptedBadge /> : null}
      </div>
    </li>
  );
}

/** The assistant, beside whatever screen is open (exploration 05, option A). Presentational. */
export function AgentPanel({
  answers,
  suggested,
  scripted,
  working,
  onAsk,
  onStop,
  onOpenActivity,
  onClose,
  edits,
  decisions,
  onDecision,
}: AgentPanelProps) {
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const last = answers.at(-1);
  // Keep the newest answer in view as it arrives.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [answers.length, last?.text, last?.steps.length]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || working) return;
    onAsk(question);
    setDraft('');
  };

  return (
    <aside className={styles.panel} aria-label="Ask about this schedule">
      <header className={styles.head}>
        <h2 className={styles.title}>Ask</h2>
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      </header>
      <div className={styles.thread}>
        {answers.length === 0 ? (
          <div className={styles.intro}>
            <p className={styles.say}>
              The assistant answers questions about the two updates you have loaded. It looks things
              up with the same tools as these screens, and every activity it names opens in the
              grid.
            </p>
            {scripted ? (
              <p className={styles.quiet}>
                On this site it is scripted: it answers the suggested questions below from your
                loaded schedule, but the wording is fixed and it cannot read other questions.
              </p>
            ) : null}
          </div>
        ) : (
          <ol className={styles.turns}>
            {answers.map((answer, index) => (
              <AnswerView
                key={index}
                index={index}
                answer={answer}
                onOpenActivity={onOpenActivity}
                edits={edits}
                decisions={decisions}
                onDecision={onDecision}
              />
            ))}
          </ol>
        )}
        <div ref={end} />
      </div>
      <div className={styles.foot}>
        <div className={styles.suggested} aria-label="Suggested questions">
          {suggested.map((question) => (
            <button
              key={question.id}
              type="button"
              className={styles.suggestion}
              disabled={working}
              onClick={() => onAsk(question.text)}
            >
              {question.text}
            </button>
          ))}
        </div>
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.hidden} htmlFor="agent-question">
            Your question
          </label>
          <textarea
            id="agent-question"
            className={styles.input}
            rows={2}
            maxLength={2000}
            value={draft}
            placeholder={
              scripted ? 'Choose a suggested question, or type one' : 'Ask about these updates'
            }
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) submit(event);
            }}
          />
          {working ? (
            <Button onClick={onStop}>Stop</Button>
          ) : (
            <Button variant="primary" type="submit" disabled={!draft.trim()}>
              Ask
            </Button>
          )}
        </form>
      </div>
    </aside>
  );
}
