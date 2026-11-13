import { BALANCE } from '../../data/balance';
import type { CreatureId } from '../../data/creatures';
import type { PlacedLayer, SimEvent, TowerState } from '../sim-types';

export type { CreatureId };

/** A timed effect of a creature. The effect id is the creature id. */
export interface ActiveEffect {
  id: CreatureId;
  /** Layers (drops, for rainbow) left until the effect ends. */
  layersLeft: number;
  level: number;
  boosted: boolean;
  /**
   * The strength already resolved for level and boost: tolerance px (honey), coin multiplier
   * add (caramel), speed multiplier (frosty), score multiplier (sprinkle, lemon), pixels per
   * coin (crumb). Unused (0) for ghost and rainbow.
   */
  value: number;
}

/** Everything abilities and zone rules can change about a drop. */
export interface Modifiers {
  /** Multiplied. */
  speedMult: number;
  /** Multiplied. */
  scoreMult: number;
  /** Added: caramel +1 makes coins x2, two such effects x3. */
  coinMultAdd: number;
  /** Flat coins per perfect drop, not multiplied by caramel. Summed. */
  perfectCoinAdd: number;
  /** The largest of the base and all effects. */
  perfectTolerance: number;
  autoPerfect: boolean;
  guides: boolean;
  /** The smallest of the effects that set it. */
  crumbToCoinsPx: number | null;
}

export const BASE_MODIFIERS: Readonly<Modifiers> = {
  speedMult: 1,
  scoreMult: 1,
  coinMultAdd: 0,
  perfectCoinAdd: 0,
  perfectTolerance: BALANCE.drop.perfectTolerance,
  autoPerfect: false,
  guides: false,
  crumbToCoinsPx: null,
};

/** Payload of the `ability` event for abilities that start an effect. */
export interface EffectPayload {
  layers: number;
  value: number;
}
export interface ShieldPayload {
  layers: number;
}
export interface PuffPayload {
  widened: number;
}
export interface JellyPayload {
  wobbleBefore: number;
  wobbleAfter: number;
}
export interface TwinsPayload {
  bonusScore: number;
  bonusHeight: number;
}
export type AbilityPayload =
  EffectPayload | ShieldPayload | PuffPayload | JellyPayload | TwinsPayload;

/** What an ability may touch when its creature layer lands. */
export interface AbilityContext {
  creature: CreatureId;
  /** Mutable run state. */
  state: TowerState;
  level: number;
  /** The creature layer landed perfectly. */
  boosted: boolean;
  /** The creature layer that just landed (already part of `state.layers`). */
  layer: PlacedLayer;
  emit(event: SimEvent): void;
  /** Starts or extends this creature's effect (see abilities/effects.ts). */
  addEffect(layers: number, value: number): void;
}

export interface Ability {
  id: CreatureId;
  /** Runs when the creature layer lands without a miss. */
  onLand(ctx: AbilityContext): void;
  /** Contribution of an active effect to the drop modifiers. */
  modifiers?(effect: ActiveEffect): Partial<Modifiers>;
  /** The effect value is stronger when smaller (frosty speed, crumb pixels per coin). */
  lowerValueIsStronger?: boolean;
}
