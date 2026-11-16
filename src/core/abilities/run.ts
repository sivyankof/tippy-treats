import { clampLevel } from '../../data/creatures';
import type { PlacedLayer, SimEvent, TowerState } from '../sim-types';
import { addOrExtendEffect, tickEffects } from './effects';
import { ABILITIES } from './registry';
import type { AbilityContext, CreatureId, HookContext, Landing } from './types';

type Emit = (event: SimEvent) => void;

/**
 * Counts every effect and the shield down after a landed layer and reports what ended.
 * An effect that ends may leave a mastery tail in its place (`Ability.onEnd`); a tail never
 * leaves another one. Mutates `state`; the shield is reported as the effect `'shield'`.
 */
export function tickRunEffects(state: TowerState, emit: Emit): void {
  const ctx: HookContext = { state, emit };
  const ended: string[] = tickEffects(state.effects, (effect) =>
    effect.tail ? null : (ABILITIES[effect.id].onEnd?.(effect, ctx) ?? null),
  ).map((effect) => effect.id);
  if (state.shield > 0) {
    state.shield -= 1;
    if (state.shield === 0) {
      state.shieldLevel = 0;
      ended.push('shield');
    }
  }
  for (const effect of ended) emit({ type: 'effect_end', effect });
}

/** Tells every active effect how the layer that fell under it landed (before the countdown). */
export function runLandingHooks(state: TowerState, emit: Emit, landing: Landing): void {
  const ctx: HookContext = { state, emit };
  for (const effect of state.effects) ABILITIES[effect.id].afterLanding?.(effect, landing, ctx);
}

/**
 * Tells every active effect about a miss, and the shield owner about a save. `shieldLevel` is the
 * level of the shield that saved the miss, `null` when no shield did.
 */
export function runMissHooks(state: TowerState, emit: Emit, shieldLevel: number | null): void {
  const ctx: HookContext = { state, emit };
  for (const effect of state.effects) ABILITIES[effect.id].onMiss?.(effect, ctx);
  if (shieldLevel === null) return;
  for (const ability of Object.values(ABILITIES)) ability.onShieldSave?.(shieldLevel, ctx);
}

/** A cloud began to cover the flying layer: tells every active effect. */
export function runCloudHooks(state: TowerState, emit: Emit): void {
  const ctx: HookContext = { state, emit };
  for (const effect of state.effects) ABILITIES[effect.id].onCloud?.(effect, ctx);
}

/** Runs the ability of a creature layer that has just landed. */
export function runAbility(
  state: TowerState,
  emit: Emit,
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
