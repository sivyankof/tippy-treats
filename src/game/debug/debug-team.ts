import type { TeamSlot } from '../../core/sim-types';
import { BALANCE } from '../../data/balance';
import { CREATURE_IDS, MAX_CREATURE_LEVEL, type CreatureId } from '../../data/creatures';
import { readDebugParams } from '../../util/debug-params';

/**
 * Temporary: the team of the next run, chosen with `?team=` / `?level=` or in the debug panel.
 * Kept in memory for the session. The Team screen of M6 replaces it.
 */
export interface DebugTeam {
  slots: Array<CreatureId | null>;
  level: number;
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

/** The sim team of a debug team. */
export function toTeamSlots(team: Readonly<DebugTeam>): Array<TeamSlot | null> {
  return team.slots.map((id) => (id ? { id, level: team.level } : null));
}

let current: DebugTeam | null = null;

function teamState(): DebugTeam {
  if (!current) {
    const params = readDebugParams();
    current = {
      slots: fillSlots(params.team ?? []),
      level: params.level ?? BALANCE.team.debugLevel,
    };
  }
  return current;
}

/** The team of the session; the URL parameters give its first value. */
export function getDebugTeam(): Readonly<DebugTeam> {
  return teamState();
}

export function cycleDebugSlot(index: number): void {
  const team = teamState();
  if (index < 0 || index >= team.slots.length) return;
  team.slots[index] = nextSlotValue(team.slots[index] ?? null);
}

export function cycleDebugLevel(): void {
  const team = teamState();
  team.level = nextLevel(team.level);
}

/** Forgets the chosen team so the next read starts from the URL again (tests). */
export function resetDebugTeam(): void {
  current = null;
}
