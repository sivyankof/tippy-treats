import { abilityDef, levelValue } from '../../data/creatures';
import { boostCount, NO_EFFECT_VALUE, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('ghost');

/** Guides over the tower for the next layers (a display aid, the drop rules do not change). */
export const ghost: Ability = {
  id: 'ghost',
  onLand(ctx) {
    startEffect(ctx, boostCount(levelValue(DEF.layers, ctx.level), ctx.boosted), NO_EFFECT_VALUE);
  },
  modifiers: () => ({ guides: true }),
};
