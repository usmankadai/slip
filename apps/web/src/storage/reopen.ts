/** Reads a schedule back from the OPFS cache, for reopening the open pair after a reload. */
import { decode, type ScheduleData } from '@slip/xer';
import type { SlotFacts } from '../features/import/types.ts';
import { readCached } from './scheduleCache.ts';

/**
 * The cached schedule for these facts, or null when it is not in the cache or is not the
 * same schedule. A file is cached under its hash, or under its hash and project when the
 * planner chose a project from a file that holds several.
 */
export async function reopenSchedule(facts: SlotFacts): Promise<ScheduleData | null> {
  for (const key of [`${facts.sourceHash}-p${facts.projectId}`, facts.sourceHash]) {
    const buffer = await readCached(key);
    if (!buffer) continue;
    try {
      const data = decode(buffer);
      if (data.meta.sourceHash === facts.sourceHash && data.meta.projectId === facts.projectId) {
        return data;
      }
    } catch {
      // An unreadable entry is treated as missing.
    }
  }
  return null;
}
