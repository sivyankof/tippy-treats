import { BALANCE } from '../../data/balance';
import type { AbilityContext, AbilityPayload } from './types';

/** Duration-only effects (ghost, rainbow) carry no strength value. */
export const NO_EFFECT_VALUE = 0;

/** Boosted layer count: `perfectBoost` times the count, rounded to whole layers. */
export function boostCount(count: number, boosted: boolean): number {
  return boosted ? Math.round(count * BALANCE.team.perfectBoost) : count;
}

/** Boosted amount that is not a whole number (pixels, wobble points, multipliers). */
export function boostAmount(amount: number, boosted: boolean): number {
  return boosted ? amount * BALANCE.team.perfectBoost : amount;
}

export function emitAbility(ctx: AbilityContext, payload: AbilityPayload): void {
  ctx.emit({ type: 'ability', creature: ctx.creature, boosted: ctx.boosted, payload });
}

/** Starts the creature's effect and announces it; most abilities are just this. */
export function startEffect(ctx: AbilityContext, layers: number, value: number): void {
  ctx.addEffect(layers, value);
  emitAbility(ctx, { layers, value });
}
