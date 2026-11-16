import { abilityDef, levelValue } from '../../data/creatures';
import { MASTERY } from '../../data/mastery';
import { isMaster } from '../mastery';
import { boostCount, payMastery, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('honey');

/** Sticky: a drop off by up to `value` px counts as perfect for the next layers. */
export const honey: Ability = {
  id: 'honey',
  onLand(ctx) {
    startEffect(ctx, boostCount(DEF.layers, ctx.boosted), levelValue(DEF.tolerance, ctx.level));
  },
  modifiers: (effect) => ({ perfectTolerance: effect.value }),
  /** Master "Honey trail": every perfect drop under the sticky effect pays a flat coin. */
  afterLanding(effect, landing, ctx) {
    if (isMaster(effect.level) && landing.quality === 'perfect') {
      payMastery(ctx, 'honey', MASTERY.honey.perfectCoins);
    }
  },
};
