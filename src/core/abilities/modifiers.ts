import { ABILITIES } from './registry';
import {
  BASE_MODIFIERS,
  type Ability,
  type ActiveEffect,
  type CreatureId,
  type Modifiers,
} from './types';

/**
 * Folds the active effects into the drop modifiers: speed and score multiply, the coin
 * multiplier and flat perfect coins add, tolerance and spring share take the largest value, crumb the smallest,
 * flags are or-ed.
 */
export function collectModifiers(
  effects: readonly ActiveEffect[],
  registry: Readonly<Record<CreatureId, Ability>> = ABILITIES,
): Modifiers {
  const result: Modifiers = { ...BASE_MODIFIERS };
  for (const effect of effects) {
    const part = registry[effect.id].modifiers?.(effect);
    if (!part) continue;
    result.speedMult *= part.speedMult ?? 1;
    result.scoreMult *= part.scoreMult ?? 1;
    result.coinMultAdd += part.coinMultAdd ?? 0;
    result.perfectCoinAdd += part.perfectCoinAdd ?? 0;
    result.perfectTolerance = Math.max(result.perfectTolerance, part.perfectTolerance ?? 0);
    result.autoPerfect ||= part.autoPerfect ?? false;
    result.guides ||= part.guides ?? false;
    result.springShare = Math.max(result.springShare, part.springShare ?? 0);
    if (part.crumbToCoinsPx != null) {
      result.crumbToCoinsPx = Math.min(result.crumbToCoinsPx ?? Infinity, part.crumbToCoinsPx);
    }
  }
  return result;
}
