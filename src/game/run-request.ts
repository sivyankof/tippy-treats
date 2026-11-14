import type { TeamSlot } from '../core/sim-types';
import { BALANCE } from '../data/balance';
import type { CreatureId } from '../data/creatures';
import { DEMO } from '../data/demo';

/**
 * What kind of run the game scene starts: a normal classic run, or the "Try it" demo of a
 * creature card (a short run with that creature in every slot, no rewards, back to the card).
 */
export type RunRequest =
  { kind: 'classic' } | { kind: 'demo'; creature: CreatureId; level: number; back: DemoBack };

/** The screen the creature card was opened from; the card goes back there after a demo. */
export type DemoBack = 'collection' | 'team';

export const CLASSIC_RUN: RunRequest = { kind: 'classic' };

export function demoRun(creature: CreatureId, level: number, back: DemoBack): RunRequest {
  return { kind: 'demo', creature, level, back };
}

/** The demo puts the creature into every slot, so it is the next creature layer whatever the slot. */
export function demoTeam(creature: CreatureId, level: number): Array<TeamSlot | null> {
  return Array.from({ length: BALANCE.team.slots }, () => ({ id: creature, level }));
}

/** True once a demo has placed all its layers. */
export function demoFinished(layersPlaced: number): boolean {
  return layersPlaced >= DEMO.startHeight + DEMO.drops;
}
