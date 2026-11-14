import { BALANCE } from '../data/balance';
import { clampLevel, type CreatureId } from '../data/creatures';
import { LEVEL_REWARDS } from '../data/progression';
import type { TeamSlot } from './sim-types';

/** Team slots as the save holds them: a creature id or `null` for an empty slot. */
export type TeamIds = readonly (CreatureId | null)[];

/** Owned creatures with their levels, as the save holds them. */
export type OwnedCreatures = Partial<Record<CreatureId, { level: number }>>;

/** The baker level that opens the last team slot (the `thirdTeamSlot` level reward). */
function lastSlotLevel(): number {
  for (const [level, reward] of Object.entries(LEVEL_REWARDS)) {
    if (reward.thirdTeamSlot) return Number(level);
  }
  return 1;
}

/** Number of team slots open at this baker level: all but the last until the level that opens it. */
export function openSlots(bakerLevel: number): number {
  return bakerLevel >= lastSlotLevel() ? BALANCE.team.slots : BALANCE.team.slots - 1;
}

/** The baker level the slot at `index` opens at; 1 for the slots open from the start. */
export function slotOpensAt(index: number): number {
  return index < BALANCE.team.slots - 1 ? 1 : lastSlotLevel();
}

/** A copy with exactly `BALANCE.team.slots` entries. */
function fill(team: TeamIds): Array<CreatureId | null> {
  return Array.from({ length: BALANCE.team.slots }, (_, i) => team[i] ?? null);
}

/**
 * Puts `id` into the first free open slot. Unchanged (the same array) when the creature is
 * already in the team or every open slot is taken.
 */
export function addToTeam(team: TeamIds, id: CreatureId, bakerLevel: number): TeamIds {
  if (team.includes(id)) return team;
  const free = fill(team).findIndex((slot, i) => slot === null && i < openSlots(bakerLevel));
  if (free < 0) return team;
  const next = fill(team);
  next[free] = id;
  return next;
}

/** Empties the slot at `index`. */
export function removeFromTeam(team: TeamIds, index: number): TeamIds {
  if (team[index] === undefined || team[index] === null) return team;
  const next = fill(team);
  next[index] = null;
  return next;
}

/** True when an open slot is free and an owned creature is not in the team (the hint by "Play"). */
export function canFillTeam(team: TeamIds, owned: OwnedCreatures, bakerLevel: number): boolean {
  const slots = fill(team);
  const hasFree = slots.some((slot, i) => slot === null && i < openSlots(bakerLevel));
  const ownedIds = Object.keys(owned) as CreatureId[];
  return hasFree && ownedIds.some((id) => !slots.includes(id));
}

/** The sim team of the save: owned creatures with their levels; locked, unowned and repeated entries are empty. */
export function runTeam(
  team: TeamIds,
  owned: OwnedCreatures,
  bakerLevel: number,
): Array<TeamSlot | null> {
  const seen = new Set<CreatureId>();
  return fill(team).map((id, i) => {
    const entry = id === null ? undefined : owned[id];
    if (id === null || !entry || seen.has(id) || i >= openSlots(bakerLevel)) return null;
    seen.add(id);
    return { id, level: clampLevel(entry.level) };
  });
}

/** The layer index the creature of each slot first arrives at: 6, 12, 18. */
export function slotLayers(): number[] {
  return Array.from({ length: BALANCE.team.slots }, (_, i) => (i + 1) * BALANCE.team.creatureEvery);
}
