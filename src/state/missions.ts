// The missions of the day as pure functions over the save.
import { earn } from '../core/economy';
import {
  applyRunStats,
  claimChest,
  claimMission,
  claimableCount,
  missionsForDay,
  rerollMission,
  type RunStats,
} from '../core/missions';
import type { Save } from '../core/save/schema';

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

/** The save with the mission claimed and its coins paid; null when it cannot be claimed. */
export function withMissionClaimed(
  save: Save,
  index: number,
): { save: Save; coins: number } | null {
  const claimed = claimMission(save.missions, index);
  if (claimed.coins <= 0) return null;
  const paid = earn(save, { coins: claimed.coins });
  return { save: { ...paid, missions: claimed.missions }, coins: claimed.coins };
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
