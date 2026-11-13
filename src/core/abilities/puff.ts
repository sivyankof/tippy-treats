import { abilityDef, levelValue } from '../../data/creatures';
import { cappedWidening } from '../scoring';
import { boostAmount, emitAbility } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('puff');

/** Widens the creature layer at once, never beyond the maximum width. */
export const puff: Ability = {
  id: 'puff',
  onLand(ctx) {
    const widened = cappedWidening(
      ctx.layer.width,
      boostAmount(levelValue(DEF.widen, ctx.level), ctx.boosted),
    );
    ctx.layer.width += widened;
    emitAbility(ctx, { widened });
  },
};
