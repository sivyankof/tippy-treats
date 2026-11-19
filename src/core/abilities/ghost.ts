import { abilityDef, levelValue } from '../../data/creatures/creatures';
import { isMaster } from '../mastery';
import { boostCount, NO_EFFECT_VALUE, payMastery, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('ghost');

/**
 * Guides over the tower for the next layers (a display aid, the drop rules do not change); from
 * `centreMarkFrom` they mark the centre too, and at the master level a cloud is see-through
 * ("Not scary", which the bot model reads as a smaller error under the cloud).
 */
export const ghost: Ability = {
  id: 'ghost',
  onLand(ctx) {
    startEffect(ctx, boostCount(levelValue(DEF.layers, ctx.level), ctx.boosted), NO_EFFECT_VALUE);
  },
  modifiers: (effect) => ({
    guides: true,
    centreMark: effect.level >= DEF.centreMarkFrom,
    guidesMaster: isMaster(effect.level),
  }),
  onCloud(effect, ctx) {
    if (isMaster(effect.level)) payMastery(ctx, 'ghost', 0);
  },
};
