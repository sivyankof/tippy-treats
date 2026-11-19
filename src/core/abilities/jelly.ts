import { abilityDef, levelValue } from '../../data/creatures/creatures';
import { MASTERY } from '../../data/creatures/mastery';
import { isMaster } from '../creatures/mastery';
import { boostAmount, boostCount, emitAbility, payMastery } from './helpers';
import { PERCENT } from '../../util/math';
import type { Ability } from './types';

const DEF = abilityDef('jelly');

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
  /** Master "Long bounce": one more layer springs with a part of the spring (no wobble relief). */
  onEnd(effect, ctx) {
    if (!isMaster(effect.level)) return null;
    payMastery(ctx, 'jelly', 0);
    return {
      id: 'jelly',
      layersLeft: MASTERY.jelly.tailLayers,
      level: effect.level,
      boosted: effect.boosted,
      value: effect.value * MASTERY.jelly.tailShareMult,
      tail: true,
    };
  },
};
