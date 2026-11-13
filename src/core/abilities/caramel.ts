import { abilityDef, levelValue } from '../../data/creatures';
import { boostCount, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('caramel');

/** Floating and combo coins are multiplied for the next layers. */
export const caramel: Ability = {
  id: 'caramel',
  onLand(ctx) {
    startEffect(ctx, boostCount(levelValue(DEF.layers, ctx.level), ctx.boosted), DEF.coinMultAdd);
  },
  modifiers: (effect) => ({ coinMultAdd: effect.value }),
};
