import { abilityDef, levelValue } from '../../data/creatures';
import { boostCount, emitAbility } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('twins');

/** One extra layer of height and flat bonus score (not multiplied; the boost grows only the score). */
export const twins: Ability = {
  id: 'twins',
  onLand(ctx) {
    const bonusScore = boostCount(levelValue(DEF.bonusScore, ctx.level), ctx.boosted);
    ctx.state.bonusHeight += DEF.bonusHeight;
    ctx.state.score += bonusScore;
    emitAbility(ctx, { bonusScore, bonusHeight: DEF.bonusHeight });
  },
};
