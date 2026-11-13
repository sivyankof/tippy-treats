import { clampLevel } from '../../data/creatures';
import type { PlacedLayer, SimEvent, TowerState } from '../sim-types';
import { addOrExtendEffect, tickEffects } from './effects';
import { ABILITIES } from './registry';
import type { AbilityContext, CreatureId } from './types';

/**
 * Counts every effect and the shield down after a landed layer and reports what ended.
 * Mutates `state`; the shield is reported as the effect `'shield'`.
 */
export function tickRunEffects(state: TowerState, emit: (event: SimEvent) => void): void {
  const ended: string[] = tickEffects(state.effects);
  if (state.shield > 0) {
    state.shield -= 1;
    if (state.shield === 0) ended.push('shield');
  }
  for (const effect of ended) emit({ type: 'effect_end', effect });
}

/** Runs the ability of a creature layer that has just landed. */
export function runAbility(
  state: TowerState,
  emit: (event: SimEvent) => void,
  layer: PlacedLayer,
  creature: CreatureId,
  rawLevel: number,
  boosted: boolean,
): void {
  const level = clampLevel(rawLevel);
  const ability = ABILITIES[creature];
  const ctx: AbilityContext = {
    creature,
    state,
    level,
    boosted,
    layer,
    emit,
    addEffect: (layers, value) =>
      addOrExtendEffect(
        state.effects,
        { id: creature, layersLeft: layers, level, boosted, value },
        ability.lowerValueIsStronger,
      ),
  };
  ability.onLand(ctx);
}
