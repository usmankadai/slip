/** Gathers what the narrative is written from, using the same engine requests as the other screens. */
import { NONE } from '@slip/xer';
import { engine } from '../../app/engine.ts';
import { compareHealth } from '../health/model.ts';
import { fetchChangeCounts, fetchMilestoneList } from '../summary/useSummary.ts';
import { buildTrace } from '../trace/model.ts';
import type { NarrativeFacts } from './model.ts';

export async function fetchNarrativeFacts(
  dataDateA: number,
  dataDateB: number,
): Promise<NarrativeFacts> {
  const [milestones, changes, healthA, healthB] = await Promise.all([
    fetchMilestoneList(),
    fetchChangeCounts(),
    engine().request({ type: 'health', slot: 'a' }),
    engine().request({ type: 'health', slot: 'b' }),
  ]);
  // The trace of the milestone that moved furthest later: the rows come later moves first.
  const first = milestones.rows[0];
  let largest: NarrativeFacts['largest'] = null;
  if (first && first.days > 0) {
    const trace = await engine().request({ type: 'trace', taskCode: first.code });
    if (trace.slipMinutes !== NONE) {
      const view = buildTrace({
        slipWorkingDays: trace.slipWorkingDays,
        isNew: false,
        nodes: trace.nodes,
        depth: trace.depth,
        end: trace.end,
        codes: trace.codes,
        names: trace.names,
        slipDays: trace.slipDays,
        contributors: trace.contributors,
        truncated: trace.truncated,
      });
      largest = {
        name: first.name,
        code: first.code,
        days: first.days,
        causes: [...view.causes, ...view.minor],
      };
    }
  }
  return {
    dataDateA,
    dataDateB,
    milestones,
    largest,
    changes,
    health: compareHealth(healthA.checks, healthB.checks),
  };
}
