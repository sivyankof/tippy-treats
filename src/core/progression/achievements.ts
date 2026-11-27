import { MAX_CREATURE_LEVEL } from '../../data/creatures/creatures';
import {
  ACHIEVEMENTS,
  type AchievementCounter,
  type AchievementDef,
} from '../../data/games/achievements';
import type { Save } from '../save/schema';

/** Progress of one achievement for Game Center: a whole percent 0..100. */
export interface AchievementProgress {
  id: string;
  percent: number;
}

/** The part of the save the achievements read. */
export type AchievementSource = Pick<
  Save,
  'stats' | 'records' | 'streak' | 'creatures' | 'bestLap'
>;

/** The value of a counter in the save. */
export function counterValue(save: AchievementSource, counter: AchievementCounter): number {
  switch (counter) {
    case 'flies':
      return save.stats.flies;
    case 'perfects':
      return save.stats.perfects;
    case 'runs':
      return save.stats.runs;
    case 'layers':
      return save.stats.totalLayers;
    case 'combo':
      return save.records.bestCombo;
    case 'streak':
      return save.streak.best;
    case 'creatures':
      return Object.values(save.creatures).filter((c) => c !== undefined).length;
    case 'masters':
      return Object.values(save.creatures).filter((c) => (c?.level ?? 0) >= MAX_CREATURE_LEVEL)
        .length;
    case 'daily':
      return save.records.dailyBest;
    case 'height':
      return save.records.classicHeight;
    case 'lap':
      return save.bestLap;
  }
}

/** Whole percent of `value` towards `target`, rounded down (Game Center takes whole numbers), 0..100. */
export function percentOf(value: number, target: number): number {
  if (!(target > 0) || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(100, Math.floor((value / target) * 100));
}

/** The percent of every achievement by the save, in the order of `defs`. */
export function achievementPercents(
  save: AchievementSource,
  defs: readonly AchievementDef[] = ACHIEVEMENTS,
): AchievementProgress[] {
  return defs.map((def) => ({
    id: def.id,
    percent: percentOf(counterValue(save, def.counter), def.target),
  }));
}

/**
 * The achievements to report: only those whose percent grew past what was reported before
 * (`reported`, by id; a missing id counts as 0). A lower percent is never sent, so a reset of the
 * progress does not take anything back in Game Center.
 */
export function risenAchievements(
  current: readonly AchievementProgress[],
  reported: ReadonlyMap<string, number>,
): AchievementProgress[] {
  return current.filter((item) => item.percent > (reported.get(item.id) ?? 0));
}
