import { BALANCE } from '../data/balance';
import {
  BASE_MODIFIERS,
  type ActiveEffect,
  type CreatureId,
  type Modifiers,
} from './abilities/types';
import { layerSpeed, resolveDrop, type CutSide } from './drop';
import { Rng } from './rng';
import type { RunEndReason, RunMode, RunResult } from './run-result';
import { comboWidening, nextCombo, normalScore, perfectScore } from './scoring';
import {
  advanceWobblePhase,
  decayWobble,
  isSneezing,
  widthAfterSneeze,
  WOBBLE_AFTER_SNEEZE,
  wobbleAfterNormal,
  wobbleAfterPerfect,
  wobbleOffset,
} from './wobble';

export interface RunConfig {
  seed: number;
  mode: RunMode;
  team: Array<{ id: CreatureId; level: number } | null>;
  tutorial: boolean;
  /** Debug: start with this many perfect full-width layers already placed. */
  startHeight?: number;
}

export type SimPhase = 'flying' | 'falling' | 'pause' | 'await_continue' | 'over';
export type LayerKind = 'plain' | 'creature' | 'golden';
export type LandQuality = 'perfect' | 'normal';

export interface FlyingLayer {
  /** 1-based number this layer will have in the tower. */
  index: number;
  x: number;
  width: number;
  dir: 1 | -1;
  speed: number;
  kind: LayerKind;
}

export interface PlacedLayer {
  /** Resting centre, wobble not included. */
  x: number;
  width: number;
  kind: LayerKind;
  quality: LandQuality;
}

export interface TowerState {
  phase: SimPhase;
  /** Time spent in the current phase. */
  phaseMs: number;
  height: number;
  score: number;
  coins: number;
  berries: number;
  combo: number;
  bestCombo: number;
  wobble: number;
  wobblePhase: number;
  layers: PlacedLayer[];
  flying: FlyingLayer | null;
  effects: ActiveEffect[];
  zoneIndex: number;
  continuesUsed: number;
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
  | { type: 'ability'; creature: CreatureId; boosted: boolean; payload: unknown }
  | { type: 'effect_end'; effect: string }
  | { type: 'zone_change'; zoneIndex: number }
  | { type: 'golden'; perfect: boolean }
  | { type: 'run_over'; result: RunResult };

const STEP_MS = BALANCE.sim.stepMs;
/** Absorbs floating point drift so a frame of exactly N steps always runs N steps. */
const STEP_EPSILON_MS = 1e-6;

/** State machine of a single run. Knows nothing about the screen. */
export class TowerSim {
  protected readonly rng: Rng;
  private readonly config: RunConfig;
  private readonly s: TowerState;
  private accumulatorMs = 0;
  private elapsedMs = 0;
  private perfects = 0;
  /** Width of the next layer to spawn. */
  private nextWidth: number = BALANCE.layer.firstWidth;
  private endReason: RunEndReason = 'miss';

  constructor(config: RunConfig) {
    this.config = config;
    this.rng = new Rng(config.seed);
    this.s = {
      // The first step spawns the first layer, so the scene gets its `spawn` event.
      phase: 'pause',
      phaseMs: BALANCE.layer.spawnPauseMs,
      height: 0,
      score: 0,
      coins: 0,
      berries: 0,
      combo: 0,
      bestCombo: 0,
      wobble: 0,
      wobblePhase: 0,
      layers: [],
      flying: null,
      effects: [],
      zoneIndex: 0,
      continuesUsed: 0,
      shield: 0,
    };
    const startHeight = Math.max(0, Math.floor(config.startHeight ?? 0));
    for (let i = 0; i < startHeight; i++) {
      this.s.layers.push({
        x: BALANCE.tray.centerX,
        width: BALANCE.layer.firstWidth,
        kind: 'plain',
        quality: 'perfect',
      });
    }
    this.s.height = startHeight;
  }

  get state(): Readonly<TowerState> {
    return this.s;
  }

  /** Advances the run in fixed steps so the outcome does not depend on the frame rate. */
  update(dtMs: number): SimEvent[] {
    const events: SimEvent[] = [];
    if (!this.isRunning()) return events;

    this.accumulatorMs += Math.min(Math.max(0, dtMs), BALANCE.sim.maxFrameMs);
    while (this.accumulatorMs >= STEP_MS - STEP_EPSILON_MS && this.isRunning()) {
      this.accumulatorMs = Math.max(0, this.accumulatorMs - STEP_MS);
      this.step(events);
    }
    if (!this.isRunning()) this.accumulatorMs = 0;
    return events;
  }

  /** Player tap. Taps outside the flying phase are dropped, not buffered. */
  drop(): SimEvent[] {
    if (this.s.phase === 'flying') this.enter('falling');
    return [];
  }

  /** The missed layer comes back, no narrower than the restore width; wobble is cleared. */
  continueRun(): SimEvent[] {
    const events: SimEvent[] = [];
    if (this.s.phase !== 'await_continue') return events;
    this.s.continuesUsed += 1;
    this.s.wobble = 0;
    this.nextWidth = Math.max(this.nextWidth, BALANCE.continues.restoreWidth);
    this.spawn(events);
    return events;
  }

  decline(): SimEvent[] {
    const events: SimEvent[] = [];
    if (this.s.phase === 'await_continue') this.finish(events);
    return events;
  }

  /** Current centre of the drop target: the top layer with wobble, or the tray. */
  topLayerX(): number {
    return this.topRestX() + this.topSway();
  }

  private isRunning(): boolean {
    return this.s.phase !== 'await_continue' && this.s.phase !== 'over';
  }

  private enter(phase: SimPhase): void {
    this.s.phase = phase;
    this.s.phaseMs = 0;
  }

  private topRestX(): number {
    return this.s.layers.at(-1)?.x ?? BALANCE.tray.centerX;
  }

  private topSway(): number {
    if (this.s.layers.length === 0) return 0;
    return wobbleOffset(this.s.wobble, this.s.wobblePhase, 0);
  }

  /** Extension point: active effects and zone rules are merged in here. */
  private modifiers(): Readonly<Modifiers> {
    return BASE_MODIFIERS;
  }

  private step(events: SimEvent[]): void {
    const s = this.s;
    this.elapsedMs += STEP_MS;
    s.phaseMs += STEP_MS;
    s.wobble = decayWobble(s.wobble, STEP_MS);
    s.wobblePhase = advanceWobblePhase(s.wobblePhase, STEP_MS);

    if (s.phase === 'flying') {
      this.moveFlying();
    } else if (s.phase === 'falling') {
      if (s.phaseMs >= BALANCE.layer.fallMs) this.resolveLanding(events);
    } else if (s.phase === 'pause') {
      if (s.phaseMs >= BALANCE.layer.spawnPauseMs) this.spawn(events);
    }
  }

  private spawn(events: SimEvent[]): void {
    const s = this.s;
    const index = s.height + 1;
    const fromLeft = index % 2 === 1;
    const layer: FlyingLayer = {
      index,
      x: fromLeft ? BALANCE.layer.minCenterX : BALANCE.layer.maxCenterX,
      width: this.nextWidth,
      dir: fromLeft ? 1 : -1,
      speed: layerSpeed(s.height, this.modifiers().speedMult),
      kind: 'plain',
    };
    s.flying = layer;
    this.enter('flying');
    events.push({ type: 'spawn', layer: { ...layer } });
  }

  private moveFlying(): void {
    const layer = this.s.flying;
    if (!layer) return;
    const { minCenterX, maxCenterX } = BALANCE.layer;
    let x = layer.x + (layer.dir * layer.speed * STEP_MS) / 1000;
    if (x > maxCenterX) {
      x = maxCenterX - (x - maxCenterX);
      layer.dir = -1;
    } else if (x < minCenterX) {
      x = minCenterX + (minCenterX - x);
      layer.dir = 1;
    }
    layer.x = x;
  }

  private resolveLanding(events: SimEvent[]): void {
    const s = this.s;
    const flying = s.flying;
    if (!flying) return;
    const mods = this.modifiers();
    const outcome = resolveDrop({
      flyingX: flying.x,
      width: flying.width,
      targetX: this.topLayerX(),
      perfectTolerance: mods.perfectTolerance,
      autoPerfect: mods.autoPerfect,
    });
    s.flying = null;

    if (outcome.quality === 'miss') {
      this.miss(events, 'miss');
      return;
    }

    const layer: PlacedLayer = {
      x: this.topRestX() + outcome.centerOffset,
      width: outcome.newWidth,
      kind: flying.kind,
      quality: outcome.quality,
    };
    s.layers.push(layer);
    s.height = s.layers.length;
    events.push({
      type: 'land',
      quality: outcome.quality,
      dx: outcome.dx,
      cutWidth: outcome.cutWidth,
      cutSide: outcome.cutSide,
      newWidth: outcome.newWidth,
    });

    s.combo = nextCombo(s.combo, outcome.quality === 'perfect');
    if (outcome.quality === 'perfect') {
      this.perfects += 1;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      const widened = comboWidening(s.combo, layer.width);
      layer.width += widened;
      s.wobble = wobbleAfterPerfect(s.wobble);
      s.score += perfectScore(s.combo, mods.scoreMult);
      events.push({ type: 'combo', value: s.combo, widened });
    } else {
      s.wobble = wobbleAfterNormal(s.wobble, outcome.dx, flying.width);
      s.score += normalScore(mods.scoreMult);
    }

    if (isSneezing(s.wobble)) {
      layer.width = widthAfterSneeze(layer.width);
      s.wobble = WOBBLE_AFTER_SNEEZE;
      events.push({ type: 'wobble_sneeze', newWidth: layer.width });
    }

    this.nextWidth = layer.width;
    if (layer.width < BALANCE.drop.missMargin) {
      this.miss(events, 'sneeze');
    } else {
      this.enter('pause');
    }
  }

  private miss(events: SimEvent[], reason: RunEndReason): void {
    const s = this.s;
    s.combo = 0;
    this.endReason = reason;
    events.push({ type: 'miss', shielded: false });
    if (this.config.mode === 'classic' && s.continuesUsed < BALANCE.continues.max) {
      this.enter('await_continue');
    } else {
      this.finish(events);
    }
  }

  private finish(events: SimEvent[]): void {
    const s = this.s;
    this.enter('over');
    const result: RunResult = {
      seed: this.config.seed,
      mode: this.config.mode,
      height: s.height,
      score: s.score,
      coins: s.coins,
      berries: s.berries,
      perfects: this.perfects,
      bestCombo: s.bestCombo,
      continuesUsed: s.continuesUsed,
      zoneIndex: s.zoneIndex,
      durationMs: Math.round(this.elapsedMs),
      endReason: this.endReason,
    };
    events.push({ type: 'run_over', result });
  }
}
