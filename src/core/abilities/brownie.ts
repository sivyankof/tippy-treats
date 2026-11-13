import { abilityDef, levelValue } from '../../data/creatures';
import { boostCount, emitAbility } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('brownie');

/** Shield for the next miss; there is at most one, a new one only replaces a shorter one. */
export const brownie: Ability = {
  id: 'brownie',
  onLand(ctx) {
    const layers = boostCount(levelValue(DEF.layers, ctx.level), ctx.boosted);
    ctx.state.shield = Math.max(ctx.state.shield, layers);
    emitAbility(ctx, { layers });
  },
};
