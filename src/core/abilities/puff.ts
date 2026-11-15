import { abilityDef, levelValue } from '../../data/creatures';
import { growInField } from '../field';
import { cappedWidening } from '../scoring';
import { boostAmount, emitAbility } from './helpers';
import type { Ability } from './types';

const DEF = abilityDef('puff');

/** Widens the creature layer at once, never beyond the maximum width. */
export const puff: Ability = {
  id: 'puff',
  onLand(ctx) {
    const before = ctx.layer.width;
    const amount = cappedWidening(
      before,
      boostAmount(levelValue(DEF.widen, ctx.level), ctx.boosted),
    );
    Object.assign(ctx.layer, growInField(ctx.layer.x, before, amount));
    const widened = ctx.layer.width - before;
    emitAbility(ctx, { widened });
  },
};
