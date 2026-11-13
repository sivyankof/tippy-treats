import { abilityDef, levelValue } from '../../data/creatures';
import { boostCount, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('honey');

/** Sticky: a drop off by up to `value` px counts as perfect for the next layers. */
export const honey: Ability = {
  id: 'honey',
  onLand(ctx) {
    startEffect(ctx, boostCount(DEF.layers, ctx.boosted), levelValue(DEF.tolerance, ctx.level));
  },
  modifiers: (effect) => ({ perfectTolerance: effect.value }),
};
