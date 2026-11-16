import type { ActiveEffect } from './types';

/**
 * Adds an effect. The same creature never stacks: the old effect is extended instead.
 * `layersLeft` becomes the larger of the two and `value` the stronger of the two (the larger
 * one, or the smaller when `lowerValueIsStronger`). The level follows the larger level and the
 * boost flag is set if either was boosted. The per-trigger mastery counters start over, and a
 * mastery tail is replaced by the new effect as a whole. Mutates `effects`.
 */
export function addOrExtendEffect(
  effects: ActiveEffect[],
  added: ActiveEffect,
  lowerValueIsStronger = false,
): void {
  const index = effects.findIndex((e) => e.id === added.id);
  const old = effects[index];
  if (!old) {
    effects.push({ ...added });
    return;
  }
  if (old.tail) {
    effects.splice(index, 1, { ...added });
    return;
  }
  old.layersLeft = Math.max(old.layersLeft, added.layersLeft);
  old.value = lowerValueIsStronger
    ? Math.min(old.value, added.value)
    : Math.max(old.value, added.value);
  old.level = Math.max(old.level, added.level);
  old.boosted = old.boosted || added.boosted;
  delete old.uses;
  delete old.spoiled;
}

/**
 * Call after every landed layer: counts the effects down and returns the finished ones, removed.
 * `follow` may give a finished effect a successor (a mastery tail) that takes its place instead.
 */
export function tickEffects(
  effects: ActiveEffect[],
  follow: (ended: ActiveEffect) => ActiveEffect | null = () => null,
): ActiveEffect[] {
  const ended: ActiveEffect[] = [];
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    if (!effect) continue;
    effect.layersLeft -= 1;
    if (effect.layersLeft > 0) continue;
    const next = follow(effect);
    if (next) {
      effects[i] = next;
    } else {
      effects.splice(i, 1);
      ended.unshift(effect);
    }
  }
  return ended;
}
