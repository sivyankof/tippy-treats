import { previousDayBest } from '../../core/progression/prev-day';
import { dailyForDay } from '../../core/progression/daily';
import type { Save } from '../../core/save/schema';
import type { RunMode } from '../../core/run/run-result';
import { runGoals, type RunGoal } from '../../core/run/result-goal';
import { localDay, utcDay } from '../../util/calendar';

/** The goal lines of a run that starts now, read once from the save (docs/04, section 6). */
export function goalsFromSave(
  save: Pick<Save, 'stats' | 'records' | 'today' | 'prevDay' | 'daily'>,
  nowMs: number,
  run: { mode: RunMode; tutorial: boolean; startHeight: number },
): RunGoal[] {
  const localToday = localDay(nowMs);
  return runGoals({
    ...run,
    runs: save.stats.runs,
    prevBest: previousDayBest(save, localToday),
    localToday,
    record: save.records.classicHeight,
    dailyBest: dailyForDay(save.daily, utcDay(nowMs)).best,
  });
}
