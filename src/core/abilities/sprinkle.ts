import { abilityDef, levelValue } from '../../data/creatures/creatures';
import { MASTERY } from '../../data/creatures/mastery';
import { isMaster } from '../mastery';
import { boostCount, payMastery, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('sprinkle');

/** Score multiplier for the next layers. */
export const sprinkle: Ability = {
  id: 'sprinkle',
  onLand(ctx) {
    startEffect(ctx, boostCount(DEF.layers, ctx.boosted), levelValue(DEF.scoreMult, ctx.level));
  },
  modifiers: (effect) => ({ scoreMult: effect.value }),
  /**
   * Master "Volley": a perfect drop under the fireworks extends them before they count that
   * layer, at most `maxExtend` layers per trigger.
   */
  afterLanding(effect, landing, ctx) {
    const { extendLayers, maxExtend } = MASTERY.sprinkle;
    const used = effect.uses ?? 0;
    if (!isMaster(effect.level) || landing.quality !== 'perfect') return;
    if (used + extendLayers > maxExtend) return;
    effect.uses = used + extendLayers;
    effect.layersLeft += extendLayers;
    payMastery(ctx, 'sprinkle', 0);
  },
};
