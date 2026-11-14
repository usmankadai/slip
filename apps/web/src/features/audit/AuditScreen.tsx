import { useEffect, useState } from 'react';
import { listAudit } from '../../storage/auditLog.ts';
import type { SlotFacts } from '../import/types.ts';
import { AuditView, type AuditState } from './AuditView.tsx';

export function AuditScreen({
  pair,
  pairKey,
  persisted,
  onBack,
}: {
  pair: { a: SlotFacts; b: SlotFacts };
  pairKey: string;
  persisted: boolean | null;
  onBack: () => void;
}) {
  const [state, setState] = useState<AuditState>({ status: 'loading' });
  useEffect(() => {
    let current = true;
    void listAudit(pairKey).then((entries) => {
      if (current) setState(entries === null ? { status: 'error' } : { status: 'ready', entries });
    });
    return () => {
      current = false;
    };
  }, [pairKey]);
  return (
    <AuditView
      projectName={pair.b.projectName}
      dataDateA={pair.a.dataDate}
      dataDateB={pair.b.dataDate}
      state={state}
      persisted={persisted}
      onBack={onBack}
    />
  );
}
