import { useCallback, useEffect, useRef, useState } from 'react';
import { formatXerDate } from '@slip/xer';
import type { SlotFacts } from '../import/types.ts';
import { message } from '../summary/useSummary.ts';
import { fetchNarrativeFacts } from './facts.ts';
import { generateBlocks, ownBlock, toMarkdown, type Block, type Evidence } from './model.ts';
import { NarrativeView, type NarrativeState } from './NarrativeView.tsx';

/** Saves text as a file in the planner's downloads. Nothing leaves the browser. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function NarrativeScreen({
  pair,
  blocks,
  onBlocks,
  onEvidence,
  onBack,
}: {
  pair: { a: SlotFacts; b: SlotFacts };
  /** The blocks, kept by the app so edits survive moving between screens. null until written. */
  blocks: Block[] | null;
  onBlocks: (update: (blocks: Block[]) => Block[]) => void;
  onEvidence: (evidence: Evidence) => void;
  onBack: () => void;
}) {
  const [failure, setFailure] = useState('');
  const run = useRef(0);
  const next = useRef(1);

  const write = useCallback(() => {
    const token = ++run.current;
    setFailure('');
    fetchNarrativeFacts(pair.a.dataDate, pair.b.dataDate).then(
      (facts) => {
        if (run.current === token) onBlocks(() => generateBlocks(facts));
      },
      (error: unknown) => {
        if (run.current === token) setFailure(message(error));
      },
    );
  }, [pair.a.dataDate, pair.b.dataDate, onBlocks]);

  const written = blocks !== null;
  useEffect(() => {
    if (!written) write();
    return () => {
      run.current++;
    };
  }, [written, write]);

  const state: NarrativeState = failure
    ? { status: 'error', message: failure }
    : blocks
      ? { status: 'ready', blocks }
      : { status: 'loading' };

  const edit = (id: string, change: (block: Block) => Block | null) =>
    onBlocks((all) =>
      all.flatMap((block) => {
        if (block.id !== id) return [block];
        const changed = change(block);
        return changed ? [changed] : [];
      }),
    );

  return (
    <NarrativeView
      projectName={pair.b.projectName}
      dataDateA={pair.a.dataDate}
      dataDateB={pair.b.dataDate}
      state={state}
      onChange={(id, text) => edit(id, (block) => ({ ...block, text }))}
      onRestore={(id) => edit(id, (block) => ({ ...block, text: block.generated }))}
      onRemove={(id) => edit(id, () => null)}
      onAdd={() => onBlocks((all) => [...all, ownBlock(`own-${Date.now()}-${next.current++}`)])}
      onExport={() => {
        if (!blocks) return;
        const date = formatXerDate(pair.b.dataDate).slice(0, 10) || 'undated';
        download(
          `update-narrative-${date}.md`,
          toMarkdown(pair.b.projectName, pair.a.dataDate, pair.b.dataDate, blocks),
        );
      }}
      onEvidence={onEvidence}
      onRetry={write}
      onBack={onBack}
    />
  );
}
