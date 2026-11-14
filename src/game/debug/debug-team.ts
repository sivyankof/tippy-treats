import type { TeamSlot } from '../../core/sim-types';
import { BALANCE } from '../../data/balance';
import { CREATURE_IDS, MAX_CREATURE_LEVEL, type CreatureId } from '../../data/creatures';
import { readDebugParams } from '../../util/debug-params';

/**
 * Dev override of the team of the next run, from `?team=` / `?level=` or the debug panel. It
 * wins over the team of the save. `slots: null` keeps the save team, `level: null` keeps the
 * owned levels. Kept in memory for the page load.
 */
export interface DebugTeam {
  slots: Array<CreatureId | null> | null;
  level: number | null;
}

/** The creature that follows `current` when a slot is tapped: none, then each creature, then none. */
export function nextSlotValue(current: CreatureId | null): CreatureId | null {
  if (current === null) return CREATURE_IDS[0];
  const next = CREATURE_IDS[CREATURE_IDS.indexOf(current) + 1];
  return next ?? null;
}

/** The level that follows `level`, wrapping from the maximum to 1. */
export function nextLevel(level: number): number {
  return level >= MAX_CREATURE_LEVEL ? 1 : level + 1;
}

/** A team of `BALANCE.team.slots` entries from a possibly shorter or longer list. */
export function fillSlots(ids: readonly (CreatureId | null)[]): Array<CreatureId | null> {
  return Array.from({ length: BALANCE.team.slots }, (_, i) => ids[i] ?? null);
}

/** The sim team of a debug team whose slots are known. */
export function toTeamSlots(
  slots: readonly (CreatureId | null)[],
  level: number,
): Array<TeamSlot | null> {
  return slots.map((id) => (id ? { id, level } : null));
}

let current: DebugTeam | null = null;

function teamState(): DebugTeam {
  if (!current) {
    const params = readDebugParams();
    current = {
      slots: params.team ? fillSlots(params.team) : null,
      level: params.level ?? null,
    };
  }
  return current;
}

/** The override of the page; both fields `null` when nothing is overridden. */
export function getDebugTeam(): Readonly<DebugTeam> {
  return teamState();
}

/** True when the URL or the debug panel chose the team or the level. */
export function hasDebugTeam(): boolean {
  const team = teamState();
  return team.slots !== null || team.level !== null;
}

/**
 * The team of a normal run with the override applied: a chosen team without a level plays at
 * `BALANCE.team.debugLevel`; a level alone lifts the save team to it. `saveTeam` is null-safe:
 * the save slots, `saveRun` the save team as the sim plays it.
 */
export function resolveRunTeam(
  saveTeam: readonly (CreatureId | null)[],
  saveRun: Array<TeamSlot | null>,
): Array<TeamSlot | null> {
  const { slots, level } = teamState();
  if (slots === null && level === null) return saveRun;
  return toTeamSlots(slots ?? fillSlots(saveTeam), level ?? BALANCE.team.debugLevel);
}

/** `base` is the team shown before the first change (the save team). */
export function cycleDebugSlot(index: number, base: readonly (CreatureId | null)[]): void {
  const team = teamState();
  const slots = team.slots ?? fillSlots(base);
  if (index < 0 || index >= slots.length) return;
  slots[index] = nextSlotValue(slots[index] ?? null);
  team.slots = slots;
}

export function cycleDebugLevel(): void {
  const team = teamState();
  team.level = nextLevel(team.level ?? BALANCE.team.debugLevel);
}

/** Forgets the chosen team so the next read starts from the URL again (tests). */
export function resetDebugTeam(): void {
  current = null;
}
