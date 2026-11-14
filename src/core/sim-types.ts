import type { CreatureId } from '../data/creatures';
import type { LayerRuleKind } from '../data/zones';
import type { ActiveEffect, AbilityPayload } from './abilities/types';
import type { CutSide } from './drop';
import type { RunEndReason, RunMode, RunResult } from './run-result';

export type { RunEndReason };

export interface TeamSlot {
  id: CreatureId;
  level: number;
}

export interface RunConfig {
  seed: number;
  mode: RunMode;
  /** Slot order matters: the creature layers walk through the slots in turn; `null` is an empty slot. */
  team: Array<TeamSlot | null>;
  tutorial: boolean;
  /** Debug: start with this many perfect full-width layers already placed. */
  startHeight?: number;
}

export type SimPhase = 'flying' | 'falling' | 'pause' | 'await_continue' | 'over';
export type LayerKind = 'plain' | 'creature' | 'golden';
export type LandQuality = 'perfect' | 'normal';

/** What a layer is, decided when it is first spawned (see core/team-queue.ts). */
export interface LayerPlan {
  kind: LayerKind;
  /** Set for `kind: 'creature'`. */
  creature?: CreatureId;
  level?: number;
}

export interface FlyingLayer extends LayerPlan {
  /** 1-based number this layer will have in the tower. */
  index: number;
  x: number;
  width: number;
  dir: 1 | -1;
  /**
   * Nominal speed in px/s: base speed times the zone multiplier (capped in Space) times the
   * ability multiplier. What the layer really does each moment is `flyingSpeed(layer)`
   * (core/flight.ts): rush, the roof profile and holds are applied there.
   */
  speed: number;
  /** Zone of this layer (index into `ZONES`). */
  zoneIndex: number;
  /** Rule this layer follows; `none` in the kitchen. */
  rule: LayerRuleKind;
  /** Rush layer: holds still for the wind-up, then flies faster. */
  rush: boolean;
  /** Wind-up left, ms; the layer does not move while it is above 0. */
  windupMs: number;
  /** Fake-out stop left, ms; the layer does not move while it is above 0 and reverses at 0. */
  stopMs: number;
  /** Cloud cover left, ms; the layer is hidden while it is above 0. */
  coverMs: number;
  /**
   * Track left, px, before the cloud of this pass arrives; -1 when no cloud is due in this pass
   * (none rolled, or it has already come). Lets the view float the cloud in ahead of time.
   */
  cloudAheadPx: number;
  /** 1-based pass across the screen: starts at spawn and at every wall bounce. */
  pass: number;
}

export interface PlacedLayer extends LayerPlan {
  /** Resting centre, wobble not included. */
  x: number;
  width: number;
  quality: LandQuality;
}

export interface TowerState {
  phase: SimPhase;
  /** Time spent in the current phase. */
  phaseMs: number;
  /** Placed layers plus the bonus height of twins. */
  height: number;
  /** Extra height that is not a layer (twins count as two). */
  bonusHeight: number;
  score: number;
  coins: number;
  berries: number;
  combo: number;
  bestCombo: number;
  wobble: number;
  wobblePhase: number;
  layers: PlacedLayer[];
  flying: FlyingLayer | null;
  /** Centre x of the floating coin hanging at the height of the current layer. */
  floatingCoinX: number | null;
  effects: ActiveEffect[];
  zoneIndex: number;
  continuesUsed: number;
  /** Layers left on the brownie shield; 0 means no shield. */
  shield: number;
}

/** Where a collected coin came from (the scene animates it, the results screen sums it up). */
export type CoinSource = 'floating' | 'combo' | 'perfect' | 'crumb' | 'golden' | 'height';

export type SimEvent =
  | { type: 'spawn'; layer: FlyingLayer }
  | {
      type: 'land';
      quality: LandQuality;
      dx: number;
      cutWidth: number;
      cutSide: CutSide | null;
      newWidth: number;
    }
  | { type: 'miss'; shielded: boolean }
  | { type: 'combo'; value: number; widened: number }
  | { type: 'wobble_sneeze'; newWidth: number }
  | { type: 'coin_spawn'; x: number }
  | { type: 'coin_collect'; amount: number; source: CoinSource }
  | { type: 'ability'; creature: CreatureId; boosted: boolean; payload: AbilityPayload }
  | { type: 'effect_end'; effect: string }
  | { type: 'zone_change'; zoneIndex: number }
  | { type: 'cloud'; coverMs: number; pass: number }
  | { type: 'fakeout'; x: number; stopMs: number }
  | { type: 'golden'; perfect: boolean }
  | { type: 'run_over'; result: RunResult };
