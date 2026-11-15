/** Holds the conversation and asks questions through the loop. Lives as long as the open pair. */
import { useCallback, useRef, useState } from 'react';
import type { ToolEngine } from '@slip/agent/run';
import { engine } from '../../app/engine.ts';
import type { AuditType } from '../../storage/auditLog.ts';
import { ask, type Answer } from './loop.ts';
import type { ProposalState } from './Proposal.tsx';
import { switchToScripted, useAssistantMode } from './mode.ts';
import { SUGGESTED, scriptedTransport } from './scripted.ts';
import { liveTransport, type AgentTransport, type Message } from './transport.ts';

/** Remembered for this tab only: the planner has read the notice before the first live question. */
const NOTICE_KEY = 'slip:live-notice-read';
const noticeRead = () => {
  try {
    return sessionStorage.getItem(NOTICE_KEY) === 'yes';
  } catch {
    return false;
  }
};
const markNoticeRead = () => {
  try {
    sessionStorage.setItem(NOTICE_KEY, 'yes');
  } catch {
    // Without storage the notice is shown again after a reload, which is the safe side.
  }
};

const toolEngine: ToolEngine = {
  request: (request) => engine().request(request as never) as never,
};

export function useConversation(
  onAudit: (type: AuditType, summary: string, actor: 'agent') => void,
) {
  // Live when the server says so (D11); scripted otherwise, and from the moment the planner
  // chooses scripted answers or live answers stop being available.
  const mode = useAssistantMode();
  const [preferScripted, setPreferScripted] = useState(false);
  const live = mode === 'live' && !preferScripted;
  const transports = useRef<{ live: AgentTransport; scripted: AgentTransport }>({
    live: liveTransport(),
    scripted: scriptedTransport(),
  });
  /** A question held back until the planner has read the notice before the first live question. */
  const [waiting, setWaiting] = useState<string | null>(null);
  const messages = useRef<Message[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [working, setWorking] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, ProposalState>>({});
  const onDecision = useCallback(
    (key: string, state: ProposalState) => setDecisions((all) => ({ ...all, [key]: state })),
    [],
  );
  const stop = useRef<AbortController | null>(null);

  const send = useCallback(
    (question: string, transport: AgentTransport) => {
      if (stop.current) return;
      const controller = new AbortController();
      stop.current = controller;
      setWorking(true);
      const index = { at: -1 };
      setAnswers((all) => {
        index.at = all.length;
        return [
          ...all,
          {
            question,
            status: 'working',
            steps: [],
            text: '',
            known: [],
            proposals: [],
            scripted: transport.scripted,
            elapsedMs: 0,
            error: '',
          },
        ];
      });
      void ask({
        transport,
        engine: toolEngine,
        messages: messages.current,
        question,
        signal: controller.signal,
        onUpdate: (answer) =>
          setAnswers((all) => all.map((item, at) => (at === index.at ? answer : item))),
      }).then((answer) => {
        stop.current = null;
        setWorking(false);
        // Live answers are switched off or used up for today: scripted from now on.
        if (answer.errorCode === 'off') switchToScripted();
        const tools = [...new Set(answer.steps.map((step) => step.tool))];
        const how = tools.length ? `, using ${tools.join(', ')}` : '';
        const outcome =
          answer.status === 'done'
            ? ''
            : ` It ${answer.status === 'stopped' ? 'was stopped' : 'failed'}.`;
        onAudit(
          'agent-answer',
          `${answer.scripted ? 'Gave a scripted answer to' : 'Answered'} "${question.slice(0, 120)}"${how}.${outcome}`,
          'agent',
        );
        for (const proposal of answer.proposals) {
          onAudit(
            'agent-proposal',
            `Proposed a change to ${proposal.taskCode}: ${proposal.reason.slice(0, 160)} Waiting for your decision.`,
            'agent',
          );
        }
      });
    },
    [onAudit],
  );

  const onAsk = useCallback(
    (question: string) => {
      if (live && !noticeRead()) {
        setWaiting(question);
        return;
      }
      send(question, live ? transports.current.live : transports.current.scripted);
    },
    [live, send],
  );
  const onAcceptNotice = useCallback(() => {
    markNoticeRead();
    const question = waiting;
    setWaiting(null);
    if (question) send(question, transports.current.live);
  }, [waiting, send]);
  const onDeclineNotice = useCallback(() => {
    setPreferScripted(true);
    setWaiting(null);
  }, []);
  /** A suggested question answered from its script, after a live answer failed. */
  const onAskScripted = useCallback(
    (question: string) => send(question, transports.current.scripted),
    [send],
  );

  const onStop = useCallback(() => stop.current?.abort(), []);

  return {
    answers,
    working,
    scripted: !live,
    waiting,
    onAsk,
    onAcceptNotice,
    onDeclineNotice,
    onAskScripted,
    scriptable: SUGGESTED.map((question) => question.text),
    onStop,
    decisions,
    onDecision,
  };
}
