// The missions of the day as pure functions over the save.
import { earn } from '../core/economy/economy';
import {
  applyRunStats,
  claimChest,
  claimMission,
  claimableCount,
  missionsForDay,
  rerollMission,
  type RunStats,
} from '../core/progression/missions';
import type { Save } from '../core/save/schema';
import { withXp, type LevelUp } from './level-up';

/** What claiming a mission paid: coins, XP and the levels the XP reached. */
export interface MissionClaim {
  coins: number;
  xp: number;
  levelUps: LevelUp[];
}

/** The save with the mission list of `today` (a new list on a later day); the same save when nothing changes. */
export function withMissionsForDay(save: Save, today: string, clockBack: boolean): Save {
  const missions = missionsForDay(
    save.missions,
    today,
    save.installId,
    save.records.classicHeight,
    save.bakerLevel,
    clockBack,
  );
  return missions === save.missions ? save : { ...save, missions };
}

export function claimableMissions(save: Save): number {
  return claimableCount(save.missions);
}

/** The save with the stats of a finished run added to the missions. */
export function withMissionStats(save: Save, stats: RunStats): Save {
  const items = applyRunStats(save.missions.items, stats);
  return { ...save, missions: { ...save.missions, items } };
}

/** The save with the mission claimed, its coins and XP paid (and the level rewards of that XP); null when it cannot be claimed. */
export function withMissionClaimed(
  save: Save,
  index: number,
): ({ save: Save } & MissionClaim) | null {
  const claimed = claimMission(save.missions, index);
  if (claimed.coins <= 0) return null;
  const paid = earn(save, { coins: claimed.coins });
  const leveled = withXp({ ...paid, missions: claimed.missions }, claimed.xp);
  return { save: leveled.save, coins: claimed.coins, xp: claimed.xp, levelUps: leveled.levelUps };
}

/** The save with the mission replaced; null when a reroll is not allowed. */
export function withMissionRerolled(save: Save, index: number, today: string): Save | null {
  const missions = rerollMission(
    save.missions,
    index,
    today,
    save.installId,
    save.records.classicHeight,
    save.bakerLevel,
  );
  return missions === save.missions ? null : { ...save, missions };
}

/** The save with the chest of the day opened and its berries paid; null when it is not open yet. */
export function withChestClaimed(save: Save): { save: Save; berries: number } | null {
  const claimed = claimChest(save.missions);
  if (claimed.berries <= 0) return null;
  const paid = earn(save, { berries: claimed.berries });
  return { save: { ...paid, missions: claimed.missions }, berries: claimed.berries };
}
