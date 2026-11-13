import { abilityDef, levelValue } from '../../data/creatures';
import { boostCount, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('frosty');
const PERCENT = 100;

/** Slows the layers that follow; the effect value is the speed multiplier. */
export const frosty: Ability = {
  id: 'frosty',
  onLand(ctx) {
    const slow = levelValue(DEF.slowPercent, ctx.level) / PERCENT;
    startEffect(ctx, boostCount(DEF.layers, ctx.boosted), 1 - slow);
  },
  modifiers: (effect) => ({ speedMult: effect.value }),
  lowerValueIsStronger: true,
};
