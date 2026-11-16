import { BALANCE } from '../../data/balance';
import { abilityDef, levelValue } from '../../data/creatures';
import { MASTERY } from '../../data/mastery';
import { isMaster } from '../mastery';
import { boostCount, payMastery, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('frosty');
const PERCENT = 100;

/** Perfect tolerance of the layer after a level-5 freeze ("Rime"). */
const rimeTolerance = (): number => BALANCE.drop.perfectTolerance + MASTERY.frosty.toleranceAdd;

/** Slows the layers that follow; the effect value is the speed multiplier. */
export const frosty: Ability = {
  id: 'frosty',
  onLand(ctx) {
    const slow = levelValue(DEF.slowPercent, ctx.level) / PERCENT;
    startEffect(ctx, boostCount(DEF.layers, ctx.boosted), 1 - slow);
  },
  modifiers: (effect) =>
    effect.tail ? { perfectTolerance: rimeTolerance() } : { speedMult: effect.value },
  lowerValueIsStronger: true,
  /** Master "Rime": the first layer after the freeze flies at normal speed with a wider tolerance. */
  onEnd(effect, ctx) {
    if (!isMaster(effect.level)) return null;
    payMastery(ctx, 'frosty', 0);
    return { ...effect, layersLeft: MASTERY.frosty.tailLayers, tail: true };
  },
};
