import { MISSION_POOL, MISSIONS } from '../data/missions';
import type { MissionGroup, MissionTemplate } from '../data/missions';
import { daysBetween } from '../util/clock';
import { dailyUnlocked } from './daily';
import { Rng } from './rng';
import type { MissionProgress, Save } from './save/schema';

export type Missions = Save['missions'];

/** What a finished run reports to the missions. */
export interface RunStats {
  mode: 'classic' | 'daily';
  height: number;
  score: number;
  bestCombo: number;
  perfects: number;
  floatingCoins: number;
  abilities: number;
  maxWobble: number;
  coins: number;
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a hash of a string as a uint32 seed. */
export function seedFromText(text: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

export function missionTemplate(id: string): MissionTemplate | undefined {
  return MISSION_POOL.find((template) => template.id === id);
}

function targetOf(template: MissionTemplate, record: number): number {
  if (template.kind !== 'height') return template.target;
  const scaled = Math.round(Math.max(0, record) * template.scale);
  return Math.min(template.max, Math.max(template.min, scaled));
}

function progressOf(template: MissionTemplate, record: number): MissionProgress {
  return {
    id: template.id,
    group: template.group,
    target: targetOf(template, record),
    progress: 0,
    claimed: false,
  };
}

function drawFrom(candidates: readonly MissionTemplate[], rng: Rng): MissionTemplate {
  const template = candidates[rng.int(0, candidates.length - 1)];
  if (!template) throw new Error('mission pool group is empty');
  return template;
}

/** Templates of a group that can be dealt; the daily tower mission waits until the tower is open. */
function poolOf(group: MissionGroup, bakerLevel: number): MissionTemplate[] {
  const towerOpen = dailyUnlocked(bakerLevel);
  return MISSION_POOL.filter(
    (template) => template.group === group && (towerOpen || template.kind !== 'daily_play'),
  );
}

/** Three missions of the day, one per group, deterministic for the day and the install. */
export function pickMissions(
  day: string,
  installId: string,
  record: number,
  bakerLevel: number,
): MissionProgress[] {
  const root = new Rng(seedFromText(`${day}|${installId}`));
  return MISSIONS.groups.map((group) => {
    return progressOf(drawFrom(poolOf(group, bakerLevel), root.fork(group)), record);
  });
}

/** Keeps the list within a day, when the clock went back or when the day is earlier than the list; a later day deals a fresh list. */
export function missionsForDay(
  missions: Missions,
  day: string,
  installId: string,
  record: number,
  bakerLevel: number,
  clockBack: boolean,
): Missions {
  const hasList = missions.items.length === MISSIONS.groups.length;
  if (hasList && (clockBack || missions.day === day)) return missions;
  if (hasList && missions.day !== '' && daysBetween(missions.day, day) < 0) return missions;
  return {
    day,
    items: pickMissions(day, installId, record, bakerLevel),
    rerollUsed: false,
    chestClaimed: false,
  };
}

export function isComplete(item: MissionProgress): boolean {
  return item.progress >= item.target;
}

/** Completed missions whose reward is not yet claimed. */
export function claimableCount(missions: Missions): number {
  return missions.items.filter((item) => isComplete(item) && !item.claimed).length;
}

/** Share of progress in 0..1. */
export function share(item: Pick<MissionProgress, 'progress' | 'target'>): number {
  return item.target > 0 ? Math.min(1, item.progress / item.target) : 1;
}

/** The unfinished, unclaimed mission with the highest share at or above the "so close" threshold. */
export function closestMission(items: readonly MissionProgress[]): MissionProgress | undefined {
  let best: MissionProgress | undefined;
  for (const item of items) {
    if (item.claimed || isComplete(item) || share(item) < MISSIONS.closeShare) continue;
    if (!best || share(item) > share(best)) best = item;
  }
  return best;
}

function valueFor(template: MissionTemplate, stats: RunStats): { value: number; total: boolean } {
  switch (template.kind) {
    case 'runs':
      return { value: 1, total: true };
    case 'floating_coins':
      return { value: stats.floatingCoins, total: true };
    case 'perfects':
      return { value: stats.perfects, total: true };
    case 'abilities':
      return { value: stats.abilities, total: true };
    case 'coins':
      return { value: stats.coins, total: true };
    case 'daily_play':
      return { value: stats.mode === 'daily' ? 1 : 0, total: true };
    case 'height':
      return { value: stats.height, total: false };
    case 'combo':
      return { value: stats.bestCombo, total: false };
    case 'score':
      return { value: stats.score, total: false };
    case 'abilities_run':
      return { value: stats.abilities, total: false };
    case 'calm_run':
      return { value: stats.maxWobble < MISSIONS.calmWobble ? stats.height : 0, total: false };
  }
}

/** Adds the stats of a finished run to the missions; claimed items stay as they are. */
export function applyRunStats(
  items: readonly MissionProgress[],
  stats: RunStats,
): MissionProgress[] {
  return items.map((item) => {
    const template = missionTemplate(item.id);
    if (item.claimed || !template) return item;
    const { value, total } = valueFor(template, stats);
    const next = total ? item.progress + value : Math.max(item.progress, value);
    return { ...item, progress: Math.min(item.target, next) };
  });
}

/** Marks a completed, unclaimed mission as claimed and returns the coins to pay (0 when not allowed). */
export function claimMission(
  missions: Missions,
  index: number,
): { missions: Missions; coins: number } {
  const item = missions.items[index];
  if (!item || item.claimed || !isComplete(item)) return { missions, coins: 0 };
  const items = missions.items.map((it, i) => (i === index ? { ...it, claimed: true } : it));
  return { missions: { ...missions, items }, coins: MISSIONS.reward[item.group] };
}

/** Replaces an open mission with another template of its group, once a day (unchanged when not allowed). */
export function rerollMission(
  missions: Missions,
  index: number,
  day: string,
  installId: string,
  record: number,
  bakerLevel: number,
): Missions {
  const item = missions.items[index];
  if (!item || missions.rerollUsed || item.claimed || isComplete(item)) return missions;
  const taken = new Set(missions.items.map((it) => it.id));
  const candidates = poolOf(item.group, bakerLevel).filter((template) => !taken.has(template.id));
  if (candidates.length === 0) return missions;
  const rng = new Rng(seedFromText(`${day}|${installId}|${MISSIONS.rerollSalt}|${index}`));
  const template = drawFrom(candidates, rng);
  const items = missions.items.map((it, i) => (i === index ? progressOf(template, record) : it));
  return { ...missions, items, rerollUsed: true };
}

/** Pays the chest of the day once all three missions are claimed (0 berries otherwise). */
export function claimChest(missions: Missions): { missions: Missions; berries: number } {
  const allClaimed = missions.items.length > 0 && missions.items.every((item) => item.claimed);
  if (!allClaimed || missions.chestClaimed) return { missions, berries: 0 };
  return { missions: { ...missions, chestClaimed: true }, berries: MISSIONS.chestBerries };
}
