import { clampLevel } from '../../data/creatures/creatures';
import type { LayerPlan } from '../tower/sim-types';
import { ABILITIES } from './registry';
import {
  BASE_MODIFIERS,
  type Ability,
  type ActiveEffect,
  type CreatureId,
  type Modifiers,
} from './types';

/**
 * Folds one contribution into `result`: speed and score multiply, the coin multiplier and flat
 * perfect coins add, tolerance and spring share take the largest value, crumb the smallest,
 * flags are or-ed.
 */
function fold(result: Modifiers, part: Partial<Modifiers>): void {
  result.speedMult *= part.speedMult ?? 1;
  result.scoreMult *= part.scoreMult ?? 1;
  result.coinMultAdd += part.coinMultAdd ?? 0;
  result.perfectCoinAdd += part.perfectCoinAdd ?? 0;
  result.perfectTolerance = Math.max(result.perfectTolerance, part.perfectTolerance ?? 0);
  result.protectCut ||= part.protectCut ?? false;
  result.guides ||= part.guides ?? false;
  result.centreMark ||= part.centreMark ?? false;
  result.guidesMaster ||= part.guidesMaster ?? false;
  result.springShare = Math.max(result.springShare, part.springShare ?? 0);
  if (part.crumbToCoinsPx != null) {
    result.crumbToCoinsPx = Math.min(result.crumbToCoinsPx ?? Infinity, part.crumbToCoinsPx);
  }
}

/** Folds the active effects into the drop modifiers (see `fold`). */
export function collectModifiers(
  effects: readonly ActiveEffect[],
  registry: Readonly<Record<CreatureId, Ability>> = ABILITIES,
): Modifiers {
  const result: Modifiers = { ...BASE_MODIFIERS };
  for (const effect of effects) {
    const part = registry[effect.id].modifiers?.(effect);
    if (part) fold(result, part);
  }
  return result;
}

/**
 * The modifiers of the drop of a layer: the active effects, plus what a creature layer gives its
 * own drop (`Ability.ownLayer`: the rainbow layer from level 3 is not cut).
 */
export function dropModifiers(effects: readonly ActiveEffect[], plan: LayerPlan): Modifiers {
  const result = collectModifiers(effects);
  if (plan.kind !== 'creature' || !plan.creature) return result;
  const own = ABILITIES[plan.creature].ownLayer?.(clampLevel(plan.level ?? 1));
  if (own) fold(result, own);
  return result;
}
