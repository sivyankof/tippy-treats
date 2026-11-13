import { abilityDef, levelValue } from '../../data/creatures';
import { boostCount, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('crumb');

/** Cut edges turn into coins, one per `value` pixels. A smaller value is stronger. */
export const crumb: Ability = {
  id: 'crumb',
  onLand(ctx) {
    startEffect(ctx, boostCount(DEF.layers, ctx.boosted), levelValue(DEF.pixelsPerCoin, ctx.level));
  },
  modifiers: (effect) => ({ crumbToCoinsPx: effect.value }),
  lowerValueIsStronger: true,
};
