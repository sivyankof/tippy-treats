import { BALANCE } from '../../data/tower/balance';
import { abilityDef, levelValue } from '../../data/creatures/creatures';
import { MASTERY } from '../../data/creatures/mastery';
import { isMaster } from '../mastery';
import { boostCount, payMastery, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('caramel');

/** Floating and combo coins are multiplied for the next layers. */
export const caramel: Ability = {
  id: 'caramel',
  onLand(ctx) {
    startEffect(ctx, boostCount(levelValue(DEF.layers, ctx.level), ctx.boosted), DEF.coinMultAdd);
  },
  modifiers: (effect) => ({ coinMultAdd: effect.value }),
  /**
   * Master "Gold vein": a normal drop on a golden layer pays its coins `goldenCoinMult` times;
   * the part above the usual golden coins comes from the source `mastery`.
   */
  afterLanding(effect, landing, ctx) {
    if (isMaster(effect.level) && landing.golden && landing.quality === 'normal') {
      const extra = BALANCE.golden.normalCoins * (MASTERY.caramel.goldenCoinMult - 1);
      payMastery(ctx, 'caramel', extra);
    }
  },
};
