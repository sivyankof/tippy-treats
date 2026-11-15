// What a finished run adds beyond XP and records: streak day, mission progress and daily tiers.
import { dailyTowerChanged, type DailyPayout } from '../core/daily';
import { runLayers } from '../core/progression';
import type { RunStats } from '../core/missions';
import type { CoinSource } from '../core/sim-types';
import type { RunResult } from '../core/run-result';
import type { MissionProgress, Save } from '../core/save/schema';
import { withDailyRun } from './daily';
import { withMissionStats } from './missions';
import { withRunDayCounted } from './streak';

/** Counters the simulation result does not carry; the run tally supplies them. */
export interface RunExtras {
  floatingCoins: number;
  abilities: number;
  maxWobble: number;
  /** Coins of the run by source, for the dev tally only. */
  coinSources?: Partial<Record<CoinSource, number>>;
}

export const NO_EXTRAS: RunExtras = { floatingCoins: 0, abilities: 0, maxWobble: 0 };

export interface RunProgress {
  save: Save;
  missions: { before: MissionProgress[]; after: MissionProgress[] };
  dailyTiers: DailyPayout[];
  /** A daily run whose tower changed before it ended: it counted for nothing. */
  dailyStale: boolean;
}

/** `startHeight`: the checkpoint the run began from; missions count only the layers placed above it. */
export function statsOf(result: RunResult, extras: RunExtras, startHeight = 0): RunStats {
  return {
    mode: result.mode,
    height: runLayers(result.height, startHeight),
    score: result.score,
    bestCombo: result.bestCombo,
    perfects: result.perfects,
    floatingCoins: extras.floatingCoins,
    abilities: extras.abilities,
    maxWobble: extras.maxWobble,
    coins: result.coins,
  };
}

/**
 * Counts the finished run for the streak (local `today`), the missions and, for a daily run,
 * the daily tower (`attemptDay` is the UTC day the attempt was started on, `utcDay` today's). The missions and
 * the daily slice must already be refreshed for today.
 */
export function applyRunProgress(
  save: Save,
  result: RunResult,
  extras: RunExtras,
  today: string,
  clockBack: boolean,
  attemptDay: string,
  utcDay: string,
  startHeight = 0,
): RunProgress {
  const before = save.missions.items;
  let next = withRunDayCounted(save, today, clockBack);
  next = withMissionStats(next, statsOf(result, extras, startHeight));
  let dailyTiers: DailyPayout[] = [];
  let dailyStale = false;
  if (result.mode === 'daily') {
    const recorded = withDailyRun(next, result.height, attemptDay);
    dailyStale = !recorded.counted && dailyTowerChanged(attemptDay, utcDay);
    next = recorded.save;
    dailyTiers = recorded.paid;
  }
  return { save: next, missions: { before, after: next.missions.items }, dailyTiers, dailyStale };
}
