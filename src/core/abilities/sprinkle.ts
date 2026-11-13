import { abilityDef, levelValue } from '../../data/creatures';
import { boostCount, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('sprinkle');

/** Score multiplier for the next layers. */
export const sprinkle: Ability = {
  id: 'sprinkle',
  onLand(ctx) {
    startEffect(ctx, boostCount(DEF.layers, ctx.boosted), levelValue(DEF.scoreMult, ctx.level));
  },
  modifiers: (effect) => ({ scoreMult: effect.value }),
};
