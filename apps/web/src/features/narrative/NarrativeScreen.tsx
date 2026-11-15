import { useCallback, useEffect, useRef, useState } from 'react';
import { formatXerDate } from '@slip/xer';
import type { AuditType } from '../../storage/auditLog.ts';
import type { SlotFacts } from '../import/types.ts';
import { message } from '../summary/useSummary.ts';
import { fetchNarrativeFacts } from './facts.ts';
import {
  generateBlocks,
  markOf,
  ownBlock,
  toMarkdown,
  type Block,
  type Evidence,
} from './model.ts';
import { NarrativeView, type NarrativeState } from './NarrativeView.tsx';

/** Saves a file in the planner's downloads. Nothing leaves the browser. */
function download(name: string, content: string | Uint8Array<ArrayBuffer>, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
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
  onAudit,
  saved,
  restoring,
}: {
  pair: { a: SlotFacts; b: SlotFacts };
  /** The blocks, kept by the app so edits survive moving between screens. null until written. */
  blocks: Block[] | null;
  onBlocks: (update: (blocks: Block[]) => Block[]) => void;
  onEvidence: (evidence: Evidence) => void;
  onBack: () => void;
  /** Records something the planner did, in the audit log. */
  onAudit: (type: AuditType, summary: string) => void;
  /** Whether the paragraphs are kept in this browser: null while not known yet. */
  saved: boolean | null;
  /** True while a saved narrative is being looked for: nothing is written until it is known. */
  restoring: boolean;
}) {
  const [failure, setFailure] = useState('');
  const [exportNote, setExportNote] = useState('');
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

  const written = blocks !== null || restoring;
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
      onChange={(id, text) => {
        const before = blocks?.find((block) => block.id === id);
        edit(id, (block) => ({ ...block, text }));
        // Logged once, when a generated paragraph first stops matching its generated text.
        if (before && markOf(before) === 'generated' && markOf({ ...before, text }) === 'edited') {
          onAudit('narrative-edited', `Edited the paragraph "${before.title}".`);
        }
      }}
      onRestore={(id) => {
        const block = blocks?.find((item) => item.id === id);
        edit(id, (item) => ({ ...item, text: item.generated }));
        if (block)
          onAudit('narrative-restored', `Restored the generated text of "${block.title}".`);
      }}
      onRemove={(id) => {
        edit(id, () => null);
        onAudit('narrative-removed', 'Removed a paragraph of your own.');
      }}
      onAdd={() => {
        onBlocks((all) => [...all, ownBlock(`own-${Date.now()}-${next.current++}`)]);
        onAudit('narrative-added', 'Added a paragraph of your own.');
      }}
      onExport={() => {
        if (!blocks) return;
        const date = formatXerDate(pair.b.dataDate).slice(0, 10) || 'undated';
        const name = `update-narrative-${date}.md`;
        download(
          name,
          toMarkdown(pair.b.projectName, pair.a.dataDate, pair.b.dataDate, blocks),
          'text/markdown;charset=utf-8',
        );
        const edited = blocks.filter((block) => markOf(block) !== 'generated').length;
        onAudit(
          'narrative-exported',
          `Exported the narrative as ${name}: ${blocks.length} paragraphs, ${edited} edited or your own.`,
        );
      }}
      exportNote={exportNote}
      onExportPdf={() => {
        if (!blocks) return;
        const date = formatXerDate(pair.b.dataDate).slice(0, 10) || 'undated';
        const name = `update-narrative-${date}.pdf`;
        setExportNote('');
        // The PDF writer is loaded only when it is first used.
        import('./pdf.ts').then(
          ({ toPdf }) => {
            const pdf = toPdf(pair.b.projectName, pair.a.dataDate, pair.b.dataDate, blocks);
            download(name, pdf.bytes as Uint8Array<ArrayBuffer>, 'application/pdf');
            const edited = blocks.filter((block) => markOf(block) !== 'generated').length;
            const replaced =
              pdf.replaced > 0
                ? ` ${pdf.replaced} ${pdf.replaced === 1 ? 'character' : 'characters'} the PDF's font cannot show appear as a question mark.`
                : '';
            onAudit(
              'narrative-exported',
              `Exported the narrative as ${name}: ${blocks.length} paragraphs, ${edited} edited or your own, ${pdf.pages} ${pdf.pages === 1 ? 'page' : 'pages'}.${replaced}`,
            );
            if (replaced) {
              setExportNote(
                `The PDF is saved.${replaced} The Markdown export keeps every character.`,
              );
            }
          },
          () =>
            setExportNote('Slip could not load the PDF writer. Try again, or export as Markdown.'),
        );
      }}
      onEvidence={onEvidence}
      onRetry={write}
      onBack={onBack}
      saved={saved}
    />
  );
}
