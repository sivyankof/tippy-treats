import { abilityDef, levelValue } from '../../data/creatures/creatures';
import { MASTERY } from '../../data/creatures/mastery';
import { isMaster } from '../mastery';
import { NO_EFFECT_VALUE, payMastery, startEffect } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('rainbow');

/**
 * The next layers are not cut (a complete miss still is a miss). A boost adds layers instead of
 * scaling. The ladder: flat score for every protected layer from level 2, the rainbow layer
 * itself is not cut from level 3, the master "After the rain" at level 5.
 */
export const rainbow: Ability = {
  id: 'rainbow',
  onLand(ctx) {
    const base = levelValue(DEF.layers, ctx.level);
    startEffect(ctx, ctx.boosted ? base + DEF.boostExtraLayers : base, NO_EFFECT_VALUE);
  },
  modifiers: () => ({ protectCut: true }),
  ownLayer: (level) => (level >= DEF.ownLayerFrom ? { protectCut: true } : null),
  afterLanding(effect, landing, ctx) {
    const score = levelValue(DEF.protectedScore, effect.level);
    if (score > 0) {
      ctx.state.score += score;
      ctx.emit({ type: 'perk', creature: 'rainbow', perk: 'rainbow_protected_score', score });
    }
    // "After the rain": a perfect protected layer did not need the protection and keeps it.
    const used = effect.uses ?? 0;
    if (isMaster(effect.level) && landing.quality === 'perfect' && used < MASTERY.rainbow.returns) {
      effect.uses = used + 1;
      effect.layersLeft += 1;
      payMastery(ctx, 'rainbow', 0);
    }
  },
};
