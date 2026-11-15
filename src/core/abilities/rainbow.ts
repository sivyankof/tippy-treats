import { abilityDef, levelValue } from '../../data/creatures';
import { NO_EFFECT_VALUE, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('rainbow');

/** The next layers are not cut (a complete miss still is a miss). A boost adds layers instead of scaling. */
export const rainbow: Ability = {
  id: 'rainbow',
  onLand(ctx) {
    const base = levelValue(DEF.layers, ctx.level);
    startEffect(ctx, ctx.boosted ? base + DEF.boostExtraLayers : base, NO_EFFECT_VALUE);
  },
  modifiers: () => ({ protectCut: true }),
};
