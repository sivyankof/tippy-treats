import { abilityDef, levelValue } from '../../data/creatures';
import { boostAmount, emitAbility } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('jelly');

/** Takes wobble points off the tower. */
export const jelly: Ability = {
  id: 'jelly',
  onLand(ctx) {
    const wobbleBefore = ctx.state.wobble;
    const relief = boostAmount(levelValue(DEF.relief, ctx.level), ctx.boosted);
    ctx.state.wobble = Math.max(0, wobbleBefore - relief);
    emitAbility(ctx, { wobbleBefore, wobbleAfter: ctx.state.wobble });
  },
};
