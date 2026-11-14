// Run bookkeeping as pure functions over the save: stats, records, XP and level rewards.
import { earn, grantCreature, type Cost } from '../core/economy';
import { addXp, levelReward, xpForRun } from '../core/progression';
import type { RunResult } from '../core/run-result';
import type { Save } from '../core/save/schema';
import type { LevelReward } from '../data/progression';

/** One level reached by a run, with what it paid. */
export interface LevelUp {
  level: number;
  reward: LevelReward;
  /** The reward creature was already owned: what was paid instead of it. */
  duplicate: Cost | null;
}

/** What a finished run changed, for the results screen. */
export interface RunSummary {
  /** A new best classic height; the very first run of a player is never a record. */
  isRecord: boolean;
  /**
   * The results of this run are the first the player gets to see: they lead to the Honey
   * presentation and Home. Kept by the `firstResults` hint, so a tutorial run left through the
   * pause does not use it up.
   */
  firstRun: boolean;
  /** Best classic height before this run; `null` before the first run. */
  previousRecord: number | null;
  /** Baker level and XP before the run, so the results can fill the bar from there. */
  before: { level: number; xp: number };
  xpGained: number;
  levelUps: LevelUp[];
}

/** The summary of a run that did not reach the save (dev runs, the creature demo). */
export const EMPTY_SUMMARY: RunSummary = {
  isRecord: false,
  firstRun: false,
  previousRecord: null,
  before: { level: 1, xp: 0 },
  xpGained: 0,
  levelUps: [],
};

/**
 * Registers a finished run: stats, records, the coins of the run, XP and the level rewards.
 * Berries are not touched here: they were added the moment they were earned.
 * `startHeight` is the checkpoint a run began from; those layers earn no XP. `firstRun` says
 * whether the `firstResults` hint was still unseen.
 */
export function applyRun(
  before: Save,
  result: RunResult,
  startHeight: number,
  firstRun: boolean,
): { save: Save; summary: RunSummary } {
  const isRecord =
    result.mode === 'classic' &&
    before.stats.runs > 0 &&
    result.height > before.records.classicHeight;
  const previousRecord = before.stats.runs === 0 ? null : before.records.classicHeight;
  const xpGained = xpForRun(result.height, startHeight);
  const progress = addXp(before.bakerLevel, before.bakerXp, xpGained);
  let next: Save = {
    ...earn(before, { coins: result.coins }),
    bakerLevel: progress.level,
    bakerXp: progress.xp,
    stats: {
      ...before.stats,
      runs: before.stats.runs + 1,
      totalLayers: before.stats.totalLayers + xpGained,
      perfects: before.stats.perfects + Math.max(0, Math.floor(result.perfects)),
    },
    tutorial: { ...before.tutorial, firstRunDone: true },
  };
  if (result.mode === 'classic') {
    next = {
      ...next,
      records: {
        classicHeight: Math.max(before.records.classicHeight, result.height),
        classicScore: Math.max(before.records.classicScore, result.score),
        bestCombo: Math.max(before.records.bestCombo, result.bestCombo),
      },
    };
  }
  const levelUps: LevelUp[] = [];
  for (const level of progress.levelsGained) {
    const reward = levelReward(level);
    const applied = applyLevelReward(next, reward);
    next = applied.value;
    levelUps.push({ level, reward, duplicate: applied.duplicate });
  }
  const beforeXp = { level: before.bakerLevel, xp: before.bakerXp };
  return {
    save: next,
    summary: { isRecord, firstRun, previousRecord, before: beforeXp, xpGained, levelUps },
  };
}

/** Coins and berries of a level reward, and the creature it hands over (or its compensation). */
function applyLevelReward(
  save: Save,
  reward: LevelReward,
): { value: Save; duplicate: Cost | null } {
  const paid = earn(save, { coins: reward.coins, berries: reward.berries });
  if (reward.creature === undefined) return { value: paid, duplicate: null };
  return grantCreature(paid, reward.creature);
}
