import { abilityDef, levelValue } from '../../data/creatures';
import { MASTERY } from '../../data/mastery';
import { isMaster } from '../mastery';
import { boostCount, emitAbility, payMastery } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('brownie');

/**
 * Shield for the next miss; there is at most one, a new one only replaces a shorter one and then
 * brings its own level.
 */
export const brownie: Ability = {
  id: 'brownie',
  onLand(ctx) {
    const layers = boostCount(levelValue(DEF.layers, ctx.level), ctx.boosted);
    if (layers > ctx.state.shield) {
      ctx.state.shield = layers;
      ctx.state.shieldLevel = ctx.level;
    }
    emitAbility(ctx, { layers });
  },
  /** Master "Change": a shield that saves a miss or a sneeze pays coins. */
  onShieldSave(level, ctx) {
    if (isMaster(level)) payMastery(ctx, 'brownie', MASTERY.brownie.shieldCoins);
  },
};
