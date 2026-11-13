import { abilityDef, levelValue } from '../../data/creatures';
import { boostAmount, boostCount, emitAbility } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('jelly');
const PERCENT = 100;

/**
 * Takes wobble points off the tower, then makes the next layers spring towards the centre
 * (the effect value is the share of the offset that is taken back).
 */
export const jelly: Ability = {
  id: 'jelly',
  onLand(ctx) {
    const wobbleBefore = ctx.state.wobble;
    const relief = boostAmount(levelValue(DEF.relief, ctx.level), ctx.boosted);
    ctx.state.wobble = Math.max(0, wobbleBefore - relief);
    const layers = boostCount(DEF.springLayers, ctx.boosted);
    const value = levelValue(DEF.springPercent, ctx.level) / PERCENT;
    ctx.addEffect(layers, value);
    emitAbility(ctx, { wobbleBefore, wobbleAfter: ctx.state.wobble, layers, value });
  },
  modifiers: (effect) => ({ springShare: effect.value }),
};
