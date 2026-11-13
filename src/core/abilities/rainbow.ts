import { abilityDef, levelValue } from '../../data/creatures';
import { NO_EFFECT_VALUE, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('rainbow');

/** The next drops are perfect unless they miss completely. A boost adds drops instead of scaling. */
export const rainbow: Ability = {
  id: 'rainbow',
  onLand(ctx) {
    const base = levelValue(DEF.layers, ctx.level);
    startEffect(ctx, ctx.boosted ? base + DEF.boostExtraLayers : base, NO_EFFECT_VALUE);
  },
  modifiers: () => ({ autoPerfect: true }),
};
