import type { ActiveEffect, CreatureId } from './types';

/**
 * Adds an effect. The same creature never stacks: the old effect is extended instead.
 * `layersLeft` becomes the larger of the two and `value` the stronger of the two (the larger
 * one, or the smaller when `lowerValueIsStronger`). The level follows the larger level and the
 * boost flag is set if either was boosted. Mutates `effects`.
 */
export function addOrExtendEffect(
  effects: ActiveEffect[],
  added: ActiveEffect,
  lowerValueIsStronger = false,
): void {
  const old = effects.find((e) => e.id === added.id);
  if (!old) {
    effects.push({ ...added });
    return;
  }
  old.layersLeft = Math.max(old.layersLeft, added.layersLeft);
  old.value = lowerValueIsStronger
    ? Math.min(old.value, added.value)
    : Math.max(old.value, added.value);
  old.level = Math.max(old.level, added.level);
  old.boosted = old.boosted || added.boosted;
}

/** Call after every landed layer: counts the effects down and drops the finished ones. */
export function tickEffects(effects: ActiveEffect[]): CreatureId[] {
  const ended: CreatureId[] = [];
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    if (!effect) continue;
    effect.layersLeft -= 1;
    if (effect.layersLeft <= 0) {
      effects.splice(i, 1);
      ended.unshift(effect.id);
    }
  }
  return ended;
}
