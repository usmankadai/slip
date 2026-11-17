import { useState } from 'react';
import { Button } from '@slip/ui';
import type { EditsController } from '../../app/useEdits.ts';
import type { AuditType } from '../../storage/auditLog.ts';
import { AgentPanel } from './AgentPanel.tsx';
import { SUGGESTED } from './scripted.ts';
import { useConversation } from './useConversation.ts';
import { useMentions } from './useMentions.ts';
import styles from './agent.module.css';

/** The "Ask" button and the panel it opens. Mounted once per open pair, so the conversation belongs to it. */
export function AgentDock({
  onAudit,
  onOpenActivity,
  edits,
  selected,
}: {
  onAudit: (type: AuditType, summary: string, actor: 'agent') => void;
  onOpenActivity: (code: string) => void;
  edits: EditsController;
  /** The activity selected in the grid, offered first when `#` is typed alone. */
  selected?: string;
}) {
  const [open, setOpen] = useState(false);
  const conversation = useConversation(onAudit);
  const mentions = useMentions(selected);
  if (!open) {
    return (
      <div className={styles.open}>
        <Button variant="primary" onClick={() => setOpen(true)}>
          Ask about this schedule
        </Button>
      </div>
    );
  }
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <AgentPanel
        {...conversation}
        suggested={SUGGESTED}
        edits={edits}
        mentions={mentions.list}
        onMentionQuery={mentions.onMentionQuery}
        onOpenActivity={(code) => {
          setOpen(false);
          onOpenActivity(code);
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
