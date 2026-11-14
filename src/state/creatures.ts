// Team and creature changes as pure functions over the save.
import {
  buyCreature,
  upgradeCreature,
  type BuyError,
  type Currency,
  type EconomyResult,
  type UpgradeError,
} from '../core/economy';
import type { Save, TeamSlots } from '../core/save/schema';
import type { TeamIds } from '../core/team';
import type { CreatureId } from '../data/creatures';

/** The save with this team; creatures the player does not own and repeats become empty slots. */
export function withTeam(save: Save, team: TeamIds): Save {
  const seen = new Set<CreatureId>();
  const slots = [0, 1, 2].map((i) => {
    const id = team[i] ?? null;
    if (id === null || save.creatures[id] === undefined || seen.has(id)) return null;
    seen.add(id);
    return id;
  }) as TeamSlots;
  return { ...save, team: slots };
}

export function withCreatureBought(
  save: Save,
  id: CreatureId,
  currency: Currency,
): EconomyResult<Save, BuyError> {
  const result = buyCreature(save, id, currency);
  return result.ok ? { ok: true, value: { ...save, ...result.value } } : result;
}

/** The upgraded save and the creature's new level. */
export function withCreatureUpgraded(
  save: Save,
  id: CreatureId,
): EconomyResult<{ save: Save; level: number }, UpgradeError> {
  const result = upgradeCreature(save, id);
  if (!result.ok) return result;
  return {
    ok: true,
    value: { save: { ...save, ...result.value }, level: result.value.creatures[id]?.level ?? 1 },
  };
}
