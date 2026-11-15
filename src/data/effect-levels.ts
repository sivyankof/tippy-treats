/** How rich the effects are: all of them, the middle tier, or the bare minimum (the old "fewer effects"). */
export type EffectLevel = 'full' | 'lite' | 'minimal';

/** The levels from richest to poorest; a position in this list is a step of the automatic mode. */
export const EFFECT_LEVELS: readonly EffectLevel[] = ['full', 'lite', 'minimal'];

export function isEffectLevel(value: unknown): value is EffectLevel {
  return EFFECT_LEVELS.some((level) => level === value);
}
