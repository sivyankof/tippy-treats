import type { CheckpointHeight } from '../core/checkpoints';
import type { TeamSlot } from '../core/sim-types';
import { BALANCE } from '../data/tower/balance';
import type { CreatureId } from '../data/creatures/creatures';
import { DEMO } from '../data/run/demo';

/**
 * What kind of run the game scene starts: a normal classic run, or the "Try it" demo of a
 * creature card (a short run with that creature in every slot, no rewards, back to the card).
 */
export type RunRequest =
  | { kind: 'classic'; checkpoint?: CheckpointHeight; paidByAd?: boolean }
  | { kind: 'daily' }
  | { kind: 'demo'; creature: CreatureId; level: number; back: DemoBack };

/** The screen the creature card was opened from; the card goes back there after a demo. */
export type DemoBack = 'collection' | 'team';

export const CLASSIC_RUN: RunRequest = { kind: 'classic' };

/**
 * A classic run that starts from an opened checkpoint (paid for by the caller). `paidByAd`: a
 * rewarded ad paid for it, so it counts as a run with a rewarded ad (no interstitial after it).
 */
export function checkpointRun(height: CheckpointHeight, paidByAd = false): RunRequest {
  return paidByAd
    ? { kind: 'classic', checkpoint: height, paidByAd }
    : { kind: 'classic', checkpoint: height };
}

export const DAILY_RUN: RunRequest = { kind: 'daily' };

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
