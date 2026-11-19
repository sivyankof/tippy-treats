import { BALANCE } from '../../data/tower/balance';
import type { CreatureId } from '../../data/creatures/creatures';
import type { LandQuality, PlacedLayer, SimEvent, TowerState } from '../sim-types';

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
   * coin (crumb), spring share (jelly). Unused (0) for ghost and rainbow.
   */
  value: number;
  /**
   * A mastery tail (jelly "Long bounce", frosty "Rime"): the layer after a level-5 effect ran
   * out. A tail never starts another tail; a new trigger of the creature replaces it.
   */
  tail?: boolean;
  /**
   * Per-trigger mastery counter (sprinkle extensions, rainbow returns); cleared whenever the
   * ability fires again.
   */
  uses?: number;
  /** Lemon "Swagger": a normal drop or a miss spoiled this trigger; cleared when it fires again. */
  spoiled?: boolean;
}

/** Everything abilities can change about a drop. Zone multipliers are applied separately (core/zones.ts). */
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
  /** The layer is not cut, but the drop counts as a normal one unless it was perfect anyway. */
  protectCut: boolean;
  guides: boolean;
  /** Ghost from level 2: the guides also mark the centre of the perfect spot (display only). */
  centreMark: boolean;
  /** Guides of a level-5 ghost: a cloud is see-through ("Not scary"; the bot reads it too). */
  guidesMaster: boolean;
  /** Share (0..1) of the offset of a normal drop that the layer springs back to the centre. The largest of the effects. */
  springShare: number;
  /** The smallest of the effects that set it. */
  crumbToCoinsPx: number | null;
}

export const BASE_MODIFIERS: Readonly<Modifiers> = {
  speedMult: 1,
  scoreMult: 1,
  coinMultAdd: 0,
  perfectCoinAdd: 0,
  perfectTolerance: BALANCE.drop.perfectTolerance,
  protectCut: false,
  guides: false,
  centreMark: false,
  guidesMaster: false,
  springShare: 0,
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
  /** Layers the spring effect lasts. */
  layers: number;
  /** Share of the offset that springs back (0..1). */
  value: number;
}
export interface TwinsPayload {
  bonusScore: number;
  bonusHeight: number;
}
export type AbilityPayload =
  EffectPayload | ShieldPayload | PuffPayload | JellyPayload | TwinsPayload;

/** What a hook may touch: the mutable run state and the event stream. */
export interface HookContext {
  /** Mutable run state. */
  state: TowerState;
  emit(event: SimEvent): void;
}

/** What an ability may touch when its creature layer lands. */
export interface AbilityContext extends HookContext {
  creature: CreatureId;
  level: number;
  /** The creature layer landed perfectly. */
  boosted: boolean;
  /** The creature layer that just landed (already part of `state.layers`). */
  layer: PlacedLayer;
  /** Starts or extends this creature's effect (see abilities/effects.ts). */
  addEffect(layers: number, value: number): void;
}

/** How a layer landed, told to the effects that were active while it fell. */
export interface Landing {
  quality: LandQuality;
  /**
   * The bitten-off piece as crumb counts it: the cut of a normal drop, also when the rainbow kept
   * it (0 for a perfect drop).
   */
  pieceWidth: number;
  /** Width of the layer as it flew, before any cut. */
  flyingWidth: number;
  golden: boolean;
}

/**
 * One creature. Only `onLand` is required; the optional hooks carry the ladder properties and the
 * master effects, so a new creature needs no change in the sim (`abilities/run.ts` calls them).
 */
export interface Ability {
  id: CreatureId;
  /** Runs when the creature layer lands without a miss. */
  onLand(ctx: AbilityContext): void;
  /** Contribution of an active effect to the drop modifiers. */
  modifiers?(effect: ActiveEffect): Partial<Modifiers>;
  /** The effect value is stronger when smaller (frosty speed, crumb pixels per coin). */
  lowerValueIsStronger?: boolean;
  /** Modifiers of the drop of the creature's own layer at `level` (rainbow from level 3: not cut). */
  ownLayer?(level: number): Partial<Modifiers> | null;
  /** A layer landed while the effect was active; runs before the effect counts that layer. */
  afterLanding?(effect: ActiveEffect, landing: Landing, ctx: HookContext): void;
  /** The effect has counted its last layer; a returned effect (a mastery tail) takes its place. */
  onEnd?(effect: ActiveEffect, ctx: HookContext): ActiveEffect | null;
  /** A miss (a drop or a sneeze, shielded or not) while the effect is active. */
  onMiss?(effect: ActiveEffect, ctx: HookContext): void;
  /** A cloud began to cover the flying layer while the effect is active. */
  onCloud?(effect: ActiveEffect, ctx: HookContext): void;
  /** The shield saved a miss; `level` is the level of the creature that gave the shield. */
  onShieldSave?(level: number, ctx: HookContext): void;
}
