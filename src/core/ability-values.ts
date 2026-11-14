import { abilityDef, levelValue, type CreatureId } from '../data/creatures';

/**
 * The numbers the ability text of a creature fills in at a level: `{value}` always, and
 * `{layers}` / `{percent}` for the jelly. Keys match the placeholders of `creature.<id>.desc`.
 */
export type AbilityValues = Record<string, number>;

export function abilityValues(id: CreatureId, level: number): AbilityValues {
  const def = abilityDef(id);
  switch (def.kind) {
    case 'honey':
      return { value: levelValue(def.tolerance, level) };
    case 'puff':
      return { value: levelValue(def.widen, level) };
    case 'jelly':
      return {
        value: levelValue(def.relief, level),
        layers: def.springLayers,
        percent: levelValue(def.springPercent, level),
      };
    case 'caramel':
      return { value: levelValue(def.layers, level) };
    case 'frosty':
      return { value: levelValue(def.slowPercent, level) };
    case 'brownie':
      return { value: levelValue(def.layers, level) };
    case 'sprinkle':
      return { value: levelValue(def.scoreMult, level) };
    case 'crumb':
      return { value: levelValue(def.pixelsPerCoin, level) };
    case 'ghost':
      return { value: levelValue(def.layers, level) };
    case 'twins':
      return { value: levelValue(def.bonusScore, level) };
    case 'lemon':
      return { value: levelValue(def.scoreMult, level) };
    case 'rainbow':
      return { value: levelValue(def.layers, level) };
  }
}

/** The values that differ between two levels, as [key, from, to]. */
export function abilityChanges(
  id: CreatureId,
  from: number,
  to: number,
): Array<[string, number, number]> {
  const before = abilityValues(id, from);
  const after = abilityValues(id, to);
  return Object.keys(before)
    .filter((key) => before[key] !== after[key])
    .map((key) => [key, before[key] ?? 0, after[key] ?? 0]);
}
