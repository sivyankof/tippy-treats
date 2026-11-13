import { abilityDef, levelValue } from '../../data/creatures';
import { boostAmount, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('lemon');

/** Faster layers, a big score multiplier (the boost grows the multiplier) and a coin per perfect. */
export const lemon: Ability = {
  id: 'lemon',
  onLand(ctx) {
    startEffect(ctx, DEF.layers, boostAmount(levelValue(DEF.scoreMult, ctx.level), ctx.boosted));
  },
  modifiers: (effect) => ({
    speedMult: DEF.speedMult,
    scoreMult: effect.value,
    perfectCoinAdd: DEF.perfectCoinAdd,
  }),
};
