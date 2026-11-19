import { abilityDef, levelValue } from '../../data/creatures/creatures';
import { MASTERY } from '../../data/creatures/mastery';
import { isMaster } from '../mastery';
import { boostCount, payMastery, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('crumb');

/** Cut edges turn into coins, one per `value` pixels. A smaller value is stronger. */
export const crumb: Ability = {
  id: 'crumb',
  onLand(ctx) {
    startEffect(ctx, boostCount(DEF.layers, ctx.boosted), levelValue(DEF.pixelsPerCoin, ctx.level));
  },
  modifiers: (effect) => ({ crumbToCoinsPx: effect.value }),
  lowerValueIsStronger: true,
  /**
   * Master "Hoarder": a cut piece wider than `pieceShare` of the flying width (counted like the
   * crumb coins) pays extra coins.
   */
  afterLanding(effect, landing, ctx) {
    if (
      isMaster(effect.level) &&
      landing.quality === 'normal' &&
      landing.pieceWidth > MASTERY.crumb.pieceShare * landing.flyingWidth
    ) {
      payMastery(ctx, 'crumb', MASTERY.crumb.coins);
    }
  },
};
