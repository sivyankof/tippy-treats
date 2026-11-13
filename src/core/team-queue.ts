import { BALANCE } from '../data/balance';
import { clampLevel } from '../data/creatures';
import type { LayerPlan, TeamSlot } from './sim-types';

/** Memory of the planner between layers. */
export interface PlanState {
  /** Highest layer index planned so far (the start height before the first layer). */
  lastIndex: number;
  /** A golden layer was due but its index was taken; the next free index becomes golden. */
  goldenPending: boolean;
}

export function isCreatureIndex(index: number): boolean {
  return index > 0 && index % BALANCE.team.creatureEvery === 0;
}

/** Slot of the creature at this layer index, `null` for plain layers and for empty slots. */
export function creatureSlotAt(index: number, team: readonly (TeamSlot | null)[]): TeamSlot | null {
  if (!isCreatureIndex(index)) return null;
  const turn = index / BALANCE.team.creatureEvery - 1;
  return team[turn % BALANCE.team.slots] ?? null;
}

/**
 * Decides what the layer with this index is. Creature slots win over golden layers, and a
 * golden layer that lost its index (to a creature, or skipped by the height bonus of twins)
 * moves to the next index that is a plain layer.
 */
export function planLayer(
  index: number,
  team: readonly (TeamSlot | null)[],
  state: PlanState,
): { plan: LayerPlan; state: PlanState } {
  const { every } = BALANCE.golden;
  let pending = state.goldenPending;
  for (let skipped = state.lastIndex + 1; skipped < index; skipped++) {
    if (skipped % every === 0) pending = true;
  }
  const due = pending || index % every === 0;

  const slot = creatureSlotAt(index, team);
  if (slot) {
    return {
      plan: { kind: 'creature', creature: slot.id, level: clampLevel(slot.level) },
      state: { lastIndex: index, goldenPending: due },
    };
  }
  return {
    plan: { kind: due ? 'golden' : 'plain' },
    state: { lastIndex: index, goldenPending: false },
  };
}
