import { BALANCE } from '../data/balance';
import { clampLevel, type CreatureId } from '../data/creatures';
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

/** The next creature layer of a run, as the HUD announces it. */
export interface NextCreature {
  id: CreatureId;
  level: number;
  /** Layers before the creature layer: 0 when the layer in the air is the creature layer. */
  inLayers: number;
}

/**
 * Next creature layer for a tower of `height` (layers placed plus the bonus height of twins):
 * the flying layer has index `height + 1`. Empty slots are skipped, `null` without creatures.
 */
export function nextCreature(
  height: number,
  team: readonly (TeamSlot | null)[],
): NextCreature | null {
  if (!team.some((slot) => slot !== null)) return null;
  const { creatureEvery } = BALANCE.team;
  let index = Math.max(1, height + 1);
  // Every slot comes up within `slots` creature layers, so the loop is short and always ends.
  for (let tries = 0; tries <= BALANCE.team.slots; tries++, index++) {
    index = Math.ceil(index / creatureEvery) * creatureEvery;
    const slot = creatureSlotAt(index, team);
    if (slot) return { id: slot.id, level: clampLevel(slot.level), inLayers: index - height - 1 };
  }
  return null;
}

/** The layer being attempted; a retry (shield, continue) of the same index keeps it. */
export interface LayerAttempt {
  index: number;
  plan: LayerPlan;
}

/**
 * Plan for the layer at `index`: a retry of the attempted index reuses its plan, a new index
 * is planned and advances the planner state. `fresh` tells the caller it is a new index.
 */
export function attemptLayer(
  attempt: LayerAttempt | null,
  index: number,
  team: readonly (TeamSlot | null)[],
  state: PlanState,
): { attempt: LayerAttempt; state: PlanState; fresh: boolean } {
  if (attempt?.index === index) return { attempt, state, fresh: false };
  const planned = planLayer(index, team, state);
  return { attempt: { index, plan: planned.plan }, state: planned.state, fresh: true };
}
