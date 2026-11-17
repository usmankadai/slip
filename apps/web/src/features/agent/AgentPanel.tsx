import { useEffect, useRef, useState, type FormEvent } from 'react';
import { answerBlocks, partsOf } from '@slip/agent';
import {
  AgentSteps,
  AgentText,
  Button,
  MentionInput,
  Notice,
  ScriptedBadge,
  type MentionList,
} from '@slip/ui';
import type { EditsController } from '../../app/useEdits.ts';
import { OPEN_DATA_FLOW } from '../dataflow/flows.ts';
import type { Answer } from './loop.ts';
import { Proposal, type ProposalState } from './Proposal.tsx';
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
  /** A question held until the planner has read the notice before the first live question. */
  waiting?: string | null;
  onAcceptNotice?: () => void;
  onDeclineNotice?: () => void;
  /** Answers a suggested question from its script, after a live answer failed. */
  onAskScripted?: (question: string) => void;
  /** Questions that have a scripted answer. */
  scriptable?: readonly string[];
  /** The list for a `#` mention being typed, and where the panel says what is being typed. */
  mentions?: MentionList | null;
  onMentionQuery?: (query: string | null) => void;
}

const ignore = () => {};

/** Opens "Where your data goes", which lives in the footer. */
const showDataFlow = () => dispatchEvent(new Event(OPEN_DATA_FLOW));

function AnswerView({
  answer,
  index,
  onOpenActivity,
  edits,
  decisions,
  onDecision,
  onAskScripted,
}: {
  onAskScripted: (() => void) | null;
  answer: Answer;
  index: number;
  onOpenActivity: (code: string) => void;
  edits: EditsController;
  decisions: Record<string, ProposalState>;
  onDecision: (key: string, state: ProposalState) => void;
}) {
  const blocks = answerBlocks(answer.text, new Set(answer.known));
  const unverified = partsOf(blocks).filter((part) => part.kind === 'unverified').length;
  return (
    <li className={styles.turn}>
      <p className={styles.question}>{answer.question}</p>
      <div className={styles.answer}>
        <AgentSteps
          steps={answer.steps}
          working={answer.status === 'working'}
          seconds={answer.elapsedMs / 1000}
        />
        {answer.text ? <AgentText blocks={blocks} onOpen={onOpenActivity} /> : null}
        {answer.status === 'working' && !answer.text ? (
          <p className={styles.quiet}>Looking at the schedule</p>
        ) : null}
        {answer.status === 'error' ? (
          <Notice
            tone="attention"
            action={
              onAskScripted ? (
                <Button variant="quiet" onClick={onAskScripted}>
                  Show a scripted answer instead
                </Button>
              ) : undefined
            }
          >
            {answer.error || 'The assistant could not answer.'}
          </Notice>
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
                <Proposal
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
  waiting = null,
  onAcceptNotice,
  onDeclineNotice,
  onAskScripted,
  scriptable = [],
  mentions = null,
  onMentionQuery = ignore,
}: AgentPanelProps) {
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const last = answers.at(-1);
  // Keep the newest answer in view as it arrives.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [answers.length, last?.text, last?.steps.length]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
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
            ) : (
              <p className={styles.quiet}>
                Answers are written live by Claude. Your question and the rows it looks up are sent
                to Anthropic to answer it; your files are not uploaded.
              </p>
            )}
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
                onAskScripted={
                  onAskScripted &&
                  !answer.scripted &&
                  !working &&
                  scriptable.includes(answer.question)
                    ? () => onAskScripted(answer.question)
                    : null
                }
              />
            ))}
          </ol>
        )}
        <div ref={end} />
      </div>
      <div className={styles.foot}>
        {waiting !== null ? (
          <Notice
            tone="attention"
            title="Before your first live question"
            action={
              <>
                <Button variant="primary" onClick={onAcceptNotice}>
                  Send it
                </Button>
                <Button variant="quiet" onClick={onDeclineNotice}>
                  Use scripted answers
                </Button>
                <Button variant="quiet" onClick={showDataFlow}>
                  Where your data goes
                </Button>
              </>
            }
          >
            Your question and the rows the assistant asks for to answer it, including activity
            codes, names and dates, will be sent through Slip&apos;s server to Anthropic. Your files
            are not uploaded.
          </Notice>
        ) : null}
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
          <MentionInput
            id="agent-question"
            rows={2}
            maxLength={2000}
            value={draft}
            placeholder={
              scripted
                ? 'Choose a suggested question, or type one'
                : 'Ask about these updates. Type # to name an activity'
            }
            onChange={setDraft}
            onSubmit={() => submit()}
            onMentionQuery={onMentionQuery}
            list={mentions}
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
