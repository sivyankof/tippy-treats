import { abilityDef, levelValue } from '../../data/creatures';
import { MASTERY } from '../../data/mastery';
import { isMaster } from '../mastery';
import { boostAmount, payMastery, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('lemon');

/** Faster layers, a big score multiplier (the boost grows the multiplier) and a coin per perfect. */
export const lemon: Ability = {
  id: 'lemon',
  onLand(ctx) {
    startEffect(ctx, DEF.layers, boostAmount(levelValue(DEF.scoreMult, ctx.level), ctx.boosted));
  },
  modifiers: (effect) => ({
    speedMult: DEF.speedMult,
    scoreMult: effect.value,
    perfectCoinAdd: DEF.perfectCoinAdd,
  }),
  /**
   * Master "Swagger": every layer of one trigger perfect pays coins on the last of them; a normal
   * drop (a protected one too) or any miss spoils the trigger.
   */
  afterLanding(effect, landing, ctx) {
    if (!isMaster(effect.level)) return;
    if (landing.quality !== 'perfect') effect.spoiled = true;
    else if (effect.layersLeft === 1 && !effect.spoiled) {
      payMastery(ctx, 'lemon', MASTERY.lemon.allPerfectCoins);
    }
  },
  onMiss(effect) {
    if (isMaster(effect.level)) effect.spoiled = true;
  },
};
