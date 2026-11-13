import type { CreatureId } from '../data/creatures';
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
  speed: number;
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
  | { type: 'coin_collect'; amount: number }
  | { type: 'ability'; creature: CreatureId; boosted: boolean; payload: AbilityPayload }
  | { type: 'effect_end'; effect: string }
  | { type: 'zone_change'; zoneIndex: number }
  | { type: 'golden'; perfect: boolean }
  | { type: 'run_over'; result: RunResult };
