// Run bookkeeping as pure functions over the save: stats, records, XP and level rewards.
import { withReached } from '../core/checkpoints';
import { earn, grantCreature } from '../core/economy';
import type { DailyPayout } from '../core/daily';
import { bakeLayers } from '../core/oven';
import { runLayers } from '../core/progression';
import { recordCreaturesReached } from '../core/record-unlocks';
import type { RunResult } from '../core/run-result';
import type { MissionProgress, Save } from '../core/save/schema';
import type { CreatureId } from '../data/creatures';
import { withXp, type LevelUp } from './level-up';

export type { LevelUp };

/** Fresh layers of the oven left after a run, and whether that run emptied it (the gentle message). */
export interface OvenSummary {
  /** Fresh layers this run was paid for (0 when the oven was already spent). */
  fresh: number;
  left: number;
  ranOut: boolean;
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
  /** The oven after the run; `null` for a run that did not reach the save. */
  oven: OvenSummary | null;
  levelUps: LevelUp[];
  /** Creatures the record of this run opened (a creature with a record way, like the twins). */
  recordCreatures: CreatureId[];
  /** The missions of the day before and after this run, for the progress lines of the results. */
  missions: { before: MissionProgress[]; after: MissionProgress[] };
  /** Daily tower tiers this run reached and paid (empty outside the daily tower). */
  dailyTiers: DailyPayout[];
  /** A daily run whose tower changed (midnight UTC) before it ended: it counted for nothing. */
  dailyStale: boolean;
}

/** The summary of a run that did not reach the save (dev runs, the creature demo). */
export const EMPTY_SUMMARY: RunSummary = {
  isRecord: false,
  firstRun: false,
  previousRecord: null,
  before: { level: 1, xp: 0 },
  xpGained: 0,
  oven: null,
  levelUps: [],
  recordCreatures: [],
  missions: { before: [], after: [] },
  dailyTiers: [],
  dailyStale: false,
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
  /** Local day the run ended on (`YYYY-MM-DD`), for the best height of the day. */
  day: string,
  /** The clock looks set back: the oven does not start a new day. */
  clockBack = false,
): { save: Save; summary: RunSummary } {
  const isRecord =
    result.mode === 'classic' &&
    before.stats.runs > 0 &&
    result.height > before.records.classicHeight;
  const previousRecord = before.stats.runs === 0 ? null : before.records.classicHeight;
  const layers = runLayers(result.height, startHeight);
  const baked = bakeLayers(before.oven, layers, day, clockBack);
  let next: Save = {
    ...earn(before, { coins: result.coins }),
    oven: baked.oven,
    stats: {
      ...before.stats,
      runs: before.stats.runs + 1,
      totalLayers: before.stats.totalLayers + layers,
      perfects: before.stats.perfects + Math.max(0, Math.floor(result.perfects)),
    },
    tutorial: { ...before.tutorial, firstRunDone: true },
  };
  if (result.mode === 'classic') {
    const todayBest = before.today.day === day ? before.today.bestHeight : 0;
    next = {
      ...next,
      today: { day, bestHeight: Math.max(todayBest, result.height) },
      // Only a tower built from zero opens checkpoints (its full height); a run from a checkpoint
      // opens nothing new, though its height still counts for the record below.
      checkpoints: withReached(before.checkpoints, startHeight === 0 ? result.height : 0),
      records: {
        classicHeight: Math.max(before.records.classicHeight, result.height),
        classicScore: Math.max(before.records.classicScore, result.score),
        bestCombo: Math.max(before.records.bestCombo, result.bestCombo),
      },
    };
  }
  const leveled = withXp(next, baked.xp);
  const rewarded = withRecordCreatures(leveled.save);
  next = rewarded.save;
  const beforeXp = { level: before.bakerLevel, xp: before.bakerXp };
  return {
    save: next,
    summary: {
      isRecord,
      firstRun,
      previousRecord,
      before: beforeXp,
      xpGained: baked.xp,
      oven: {
        fresh: baked.before - baked.after,
        left: baked.after,
        ranOut: baked.before > 0 && baked.after === 0,
      },
      levelUps: leveled.levelUps,
      recordCreatures: rewarded.creatures,
      missions: EMPTY_SUMMARY.missions,
      dailyTiers: EMPTY_SUMMARY.dailyTiers,
      dailyStale: EMPTY_SUMMARY.dailyStale,
    },
  };
}

/** Hands over the creatures whose record way is reached by the best classic height of the save. */
function withRecordCreatures(save: Save): { save: Save; creatures: CreatureId[] } {
  const creatures = recordCreaturesReached(
    save.records.classicHeight,
    (id) => save.creatures[id] !== undefined,
  );
  let next = save;
  for (const id of creatures) next = grantCreature(next, id).value;
  return { save: next, creatures };
}
