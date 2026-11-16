import type { CreatureId } from '../data/creatures';
import type { PerkId } from '../data/mastery';
import type { LayerRuleKind } from '../data/zones';
import type { ActiveEffect, AbilityPayload } from './abilities/types';
import type { CutSide } from './drop';
import type { RunEndReason, RunMode, RunResult } from './run-result';

export type { RunEndReason };

export interface TeamSlot {
  id: CreatureId;
  level: number;
}

/** The team of a run as the HUD and the queue read it: empty slots are `null`. */
export type TeamSlots = readonly (TeamSlot | null)[];

/** What `RunConfig.speedScale` sees when a layer spawns. */
export interface SpeedScaleContext {
  /** 1-based number the spawning layer will have. */
  index: number;
  /** Height of the tower before the layer lands. */
  height: number;
  zoneIndex: number;
  /** Perfect drops in a row so far. */
  combo: number;
}

export interface RunConfig {
  seed: number;
  mode: RunMode;
  /** Slot order matters: the creature layers walk through the slots in turn; `null` is an empty slot. */
  team: Array<TeamSlot | null>;
  tutorial: boolean;
  /**
   * Layers already placed when the run begins: a checkpoint start (20, 40… with `startWidth` from
   * `data/checkpoints.ts`) or the debug `?start=`. They earn nothing: score, coins and the height
   * bonus count only the layers placed in this run.
   */
  startHeight?: number;
  /**
   * Width of the first flying layer above `startHeight`; the pre-built layers narrow evenly from
   * the first width down to it. Absent: the first width (a debug start of full-width layers).
   */
  startWidth?: number;
  /**
   * Analysis-only hook (never set by the game): called once per layer spawn, the result multiplies
   * the nominal speed of that layer. Absent means exactly the normal speed.
   */
  speedScale?: (context: SpeedScaleContext) => number;
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

/**
 * What the layer that is falling will look like when it lands, as far as the sim can tell before
 * it does: the picture the view needs. Abilities and a sneeze can still change the width.
 */
export interface LandingPreview {
  /** 1-based number the layer will have in the tower (its place among the placed layers). */
  index: number;
  kind: LayerKind;
  /** The creature of a creature layer, `null` otherwise. */
  creature: CreatureId | null;
  /** Level of the creature of a creature layer (0 for another layer). */
  level: number;
  /** Width of the placed layer. */
  width: number;
  /** Bitten edge of the placed layer; `null` for an intact one. */
  cut: CutSide | null;
  /** Width of the bitten-off piece; 0 when nothing is bitten off. */
  pieceWidth: number;
}

/** An empty preview for `TowerSim.landingPreview` to fill (one object, refilled each time). */
export function newLandingPreview(): LandingPreview {
  return { index: 0, kind: 'plain', creature: null, level: 0, width: 0, cut: null, pieceWidth: 0 };
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
  /** Level of the brownie that gave the running shield (master effect "Change"); 0 without a shield. */
  shieldLevel: number;
  /** Layers of the tempo ease left (the one in the air included); 0 outside an ease. */
  tempoLeft: number;
  /**
   * The widest the current layer may grow (and spawn): `maxWidth`, narrower from lap 2 of Space
   * (core/space-laps.ts). Set when a layer spawns; every widening of that layer respects it.
   */
  widthCap: number;
}

/** Where a collected coin came from (the scene animates it, the results screen sums it up). */
export type CoinSource =
  | 'floating'
  | 'combo'
  | 'perfect'
  | 'crumb'
  | 'golden'
  | 'height'
  /** Master effects of level-5 creatures (docs/03-creatures.md, "Мастерство"). */
  | 'mastery';

/** Where events go, one by one (a list's `push` wrapped, or a hook context's `emit`). */
export type EmitEvent = (event: SimEvent) => unknown;

export type SimEvent =
  | { type: 'spawn'; layer: FlyingLayer }
  | {
      type: 'land';
      quality: LandQuality;
      dx: number;
      cutWidth: number;
      cutSide: CutSide | null;
      newWidth: number;
      /** Width a protected layer kept that a normal drop would have cut off (rainbow). */
      savedWidth: number;
    }
  | { type: 'miss'; shielded: boolean }
  | { type: 'combo'; value: number; widened: number }
  | { type: 'wobble_sneeze'; newWidth: number }
  /** The streak reward began: this many layers fly slower, the one that just spawned first. */
  | { type: 'tempo_ease'; layers: number }
  | { type: 'coin_spawn'; x: number }
  | { type: 'coin_collect'; amount: number; source: CoinSource }
  | { type: 'ability'; creature: CreatureId; boosted: boolean; payload: AbilityPayload }
  /**
   * A master effect did something (paid, extended or returned an effect, started a tail, thinned
   * a cloud). `coins` and `score` are what it paid, 0 when nothing; the coins also come as a
   * `coin_collect` with the source `mastery`, the score is already in the run score.
   */
  | { type: 'mastery'; creature: CreatureId; coins: number; score: number }
  /** A ladder property below the master level paid flat score (rainbow from level 2). */
  | { type: 'perk'; creature: CreatureId; perk: PerkId; score: number }
  | { type: 'effect_end'; effect: string }
  | { type: 'zone_change'; zoneIndex: number }
  | { type: 'cloud'; coverMs: number; pass: number }
  | { type: 'fakeout'; x: number; stopMs: number }
  | { type: 'golden'; perfect: boolean }
  | { type: 'run_over'; result: RunResult };
