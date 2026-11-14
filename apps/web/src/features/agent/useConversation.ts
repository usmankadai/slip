/** Holds the conversation and asks questions through the loop. Lives as long as the open pair. */
import { useCallback, useRef, useState } from 'react';
import type { ToolEngine } from '@slip/agent/run';
import { engine } from '../../app/engine.ts';
import type { AuditType } from '../../storage/auditLog.ts';
import { ask, type Answer } from './loop.ts';
import type { ProposalState } from './ProposalView.tsx';
import { scriptedTransport } from './scripted.ts';
import type { AgentTransport, Message } from './transport.ts';

const toolEngine: ToolEngine = {
  request: (request) => engine().request(request as never) as never,
};

export function useConversation(
  onAudit: (type: AuditType, summary: string, actor: 'agent') => void,
) {
  // Scripted is the public default (D11). The live transport exists but the server is not deployed.
  const transport = useRef<AgentTransport>(scriptedTransport());
  const messages = useRef<Message[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [working, setWorking] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, ProposalState>>({});
  const onDecision = useCallback(
    (key: string, state: ProposalState) => setDecisions((all) => ({ ...all, [key]: state })),
    [],
  );
  const stop = useRef<AbortController | null>(null);

  const onAsk = useCallback(
    (question: string) => {
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
            scripted: transport.current.scripted,
            elapsedMs: 0,
            error: '',
          },
        ];
      });
      void ask({
        transport: transport.current,
        engine: toolEngine,
        messages: messages.current,
        question,
        signal: controller.signal,
        onUpdate: (answer) =>
          setAnswers((all) => all.map((item, at) => (at === index.at ? answer : item))),
      }).then((answer) => {
        stop.current = null;
        setWorking(false);
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

  const onStop = useCallback(() => stop.current?.abort(), []);

  return {
    answers,
    working,
    scripted: transport.current.scripted,
    onAsk,
    onStop,
    decisions,
    onDecision,
  };
}
