import { abilityDef, levelValue } from '../../data/creatures/creatures';
import { MASTERY } from '../../data/creatures/mastery';
import { growInField } from '../field';
import { isMaster } from '../mastery';
import { cappedWidening } from '../scoring';
import { boostAmount, emitAbility, payMastery } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('puff');

/** Widens the creature layer at once, never beyond the maximum width (the Space lap cap). */
export const puff: Ability = {
  id: 'puff',
  onLand(ctx) {
    const before = ctx.layer.width;
    const cap = ctx.state.widthCap;
    const amount = cappedWidening(
      before,
      boostAmount(levelValue(DEF.widen, ctx.level), ctx.boosted),
      cap,
    );
    Object.assign(ctx.layer, growInField(ctx.layer.x, before, amount, cap));
    const widened = ctx.layer.width - before;
    emitAbility(ctx, { widened });
    // Master "Sugar dust": flat score for every pixel the layer really grew.
    if (isMaster(ctx.level) && widened > 0) {
      payMastery(ctx, 'puff', 0, Math.round(widened * MASTERY.puff.scorePerPx));
    }
  },
};
