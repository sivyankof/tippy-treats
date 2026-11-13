import { BALANCE } from '../data/balance';
import { collectModifiers } from './abilities/modifiers';
import { runAbility, tickRunEffects } from './abilities/run';
import type { Modifiers } from './abilities/types';
import {
  coinCovered,
  comboCoinAmount,
  crumbCoinAmount,
  floatingCoinAmount,
  heightBonusCoins,
  rollFloatingCoin,
} from './coins';
import { layerSpeed, resolveDrop } from './drop';
import { Rng } from './rng';
import type { RunEndReason, RunResult } from './run-result';
import { comboWidening, nextCombo, normalScore, perfectScore } from './scoring';
import type {
  FlyingLayer,
  LayerPlan,
  PlacedLayer,
  RunConfig,
  SimEvent,
  SimPhase,
  TowerState,
} from './sim-types';
import { planLayer, type PlanState } from './team-queue';
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

export type {
  FlyingLayer,
  LandQuality,
  LayerKind,
  LayerPlan,
  PlacedLayer,
  RunConfig,
  SimEvent,
  SimPhase,
  TeamSlot,
  TowerState,
} from './sim-types';

const STEP_MS = BALANCE.sim.stepMs;
/** Absorbs floating point drift so a frame of exactly N steps always runs N steps. */
const STEP_EPSILON_MS = 1e-6;

/** State machine of a single run. Knows nothing about the screen. */
export class TowerSim {
  protected readonly rng: Rng;
  private readonly coinRng: Rng;
  private readonly config: RunConfig;
  private readonly s: TowerState;
  private accumulatorMs = 0;
  private elapsedMs = 0;
  private perfects = 0;
  /** Width of the next layer to spawn. */
  private nextWidth: number = BALANCE.layer.firstWidth;
  private endReason: RunEndReason = 'miss';
  private planState: PlanState;
  /** The layer being attempted; a retry (shield, continue) of the same index keeps it. */
  private attempt: { index: number; plan: LayerPlan } | null = null;

  constructor(config: RunConfig) {
    this.config = config;
    this.rng = new Rng(config.seed);
    this.coinRng = this.rng.fork('coins');
    this.s = {
      // The first step spawns the first layer, so the scene gets its `spawn` event.
      phase: 'pause',
      phaseMs: BALANCE.layer.spawnPauseMs,
      height: 0,
      bonusHeight: 0,
      score: 0,
      coins: 0,
      berries: 0,
      combo: 0,
      bestCombo: 0,
      wobble: 0,
      wobblePhase: 0,
      layers: [],
      flying: null,
      floatingCoinX: null,
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
    this.planState = { lastIndex: startHeight, goldenPending: false };
  }

  get state(): Readonly<TowerState> {
    return this.s;
  }

  /** Modifiers of the active effects: what the next drop and spawn use. */
  currentModifiers(): Readonly<Modifiers> {
    return collectModifiers(this.s.effects);
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
    if (this.attempt?.index !== index) {
      // A new index: plan the layer and roll its coin. A retry of the same index does neither.
      const planned = planLayer(index, this.config.team, this.planState);
      this.planState = planned.state;
      this.attempt = { index, plan: planned.plan };
      this.spawnCoin(events, index);
    }
    const fromLeft = index % 2 === 1;
    const layer: FlyingLayer = {
      ...this.attempt.plan,
      index,
      x: fromLeft ? BALANCE.layer.minCenterX : BALANCE.layer.maxCenterX,
      width: this.nextWidth,
      dir: fromLeft ? 1 : -1,
      speed: layerSpeed(s.height, this.currentModifiers().speedMult),
    };
    s.flying = layer;
    this.enter('flying');
    events.push({ type: 'spawn', layer: { ...layer } });
  }

  private spawnCoin(events: SimEvent[], index: number): void {
    const x = rollFloatingCoin(this.coinRng, index, this.topRestX());
    this.s.floatingCoinX = x;
    if (x !== null) events.push({ type: 'coin_spawn', x });
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

  private gainCoins(events: SimEvent[], amount: number): void {
    if (amount <= 0) return;
    this.s.coins += amount;
    events.push({ type: 'coin_collect', amount });
  }

  private resolveLanding(events: SimEvent[]): void {
    const s = this.s;
    const flying = s.flying;
    if (!flying) return;
    // Modifiers come from the effects that were active before this layer.
    const mods = this.currentModifiers();
    const outcome = resolveDrop({
      flyingX: flying.x,
      width: flying.width,
      targetX: this.topLayerX(),
      perfectTolerance: mods.perfectTolerance,
      autoPerfect: mods.autoPerfect,
      springShare: mods.springShare,
    });
    s.flying = null;
    // The floating coin is lost on a miss; a retried layer rolls no new one.
    const coinX = s.floatingCoinX;
    s.floatingCoinX = null;

    if (outcome.quality === 'miss') {
      this.nextWidth = flying.width;
      this.miss(events, 'miss');
      return;
    }

    const perfect = outcome.quality === 'perfect';
    const layer: PlacedLayer = {
      x: this.topRestX() + outcome.centerOffset,
      width: outcome.newWidth,
      kind: flying.kind,
      quality: outcome.quality,
    };
    if (flying.creature) layer.creature = flying.creature;
    if (flying.level !== undefined) layer.level = flying.level;
    s.layers.push(layer);
    s.height = s.layers.length + s.bonusHeight;
    events.push({
      type: 'land',
      quality: outcome.quality,
      dx: outcome.dx,
      cutWidth: outcome.cutWidth,
      cutSide: outcome.cutSide,
      newWidth: outcome.newWidth,
    });

    if (coinX !== null && coinCovered(coinX, layer.x, layer.width)) {
      this.gainCoins(events, floatingCoinAmount(mods));
    }
    this.score(events, layer, outcome.dx, flying.width, perfect, mods);
    this.payLanding(events, flying.kind === 'golden', perfect, outcome.cutWidth, mods);

    const emit = (event: SimEvent): number => events.push(event);
    // The shield covers the N layers after the brownie, so this layer counts with the shield
    // it had before the countdown below (a shield that runs out here still saves a sneeze here).
    const shieldedLanding = s.shield > 0;
    tickRunEffects(s, emit);
    if (flying.creature) runAbility(s, emit, layer, flying.creature, flying.level ?? 1, perfect);
    s.height = s.layers.length + s.bonusHeight;

    if (isSneezing(s.wobble)) {
      layer.width = widthAfterSneeze(layer.width);
      s.wobble = WOBBLE_AFTER_SNEEZE;
      events.push({ type: 'wobble_sneeze', newWidth: layer.width });
    }

    this.nextWidth = layer.width;
    if (layer.width < BALANCE.drop.missMargin) {
      this.miss(events, 'sneeze', shieldedLanding);
    } else {
      this.enter('pause');
    }
  }

  /** Combo, score and wobble of a landed layer. */
  private score(
    events: SimEvent[],
    layer: PlacedLayer,
    dx: number,
    flyingWidth: number,
    perfect: boolean,
    mods: Readonly<Modifiers>,
  ): void {
    const s = this.s;
    s.combo = nextCombo(s.combo, perfect);
    if (perfect) {
      this.perfects += 1;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      const widened = comboWidening(s.combo, layer.width);
      layer.width += widened;
      s.wobble = wobbleAfterPerfect(s.wobble);
      s.score += perfectScore(s.combo, mods.scoreMult);
      events.push({ type: 'combo', value: s.combo, widened });
    } else {
      s.wobble = wobbleAfterNormal(s.wobble, dx, flyingWidth);
      s.score += normalScore(mods.scoreMult);
    }
  }

  /** Coins and berries a landing pays besides the floating coin. */
  private payLanding(
    events: SimEvent[],
    golden: boolean,
    perfect: boolean,
    cutWidth: number,
    mods: Readonly<Modifiers>,
  ): void {
    const s = this.s;
    if (perfect) {
      this.gainCoins(events, comboCoinAmount(s.combo, mods));
      this.gainCoins(events, mods.perfectCoinAdd);
    } else {
      this.gainCoins(events, crumbCoinAmount(cutWidth, mods.crumbToCoinsPx));
    }
    if (!golden) return;
    events.push({ type: 'golden', perfect });
    if (perfect) {
      s.berries += BALANCE.golden.perfectBerries;
      s.score += BALANCE.score.goldenPerfectBonus;
    } else {
      this.gainCoins(events, BALANCE.golden.normalCoins);
    }
  }

  /** `shielded` defaults to the live shield; a sneeze passes the shield of its landing. */
  private miss(events: SimEvent[], reason: RunEndReason, shielded = this.s.shield > 0): void {
    const s = this.s;
    s.combo = 0;
    if (shielded) {
      // The shield eats the miss: the run goes on and the same layer (drop miss) comes back,
      // or the narrow layer stays and the next one is restored (sneeze miss). Either way the
      // next layer is at least `shieldRestoreWidth` wide.
      s.shield = 0;
      this.nextWidth = Math.max(this.nextWidth, BALANCE.team.shieldRestoreWidth);
      events.push({ type: 'miss', shielded: true });
      this.enter('pause');
      return;
    }
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
    this.gainCoins(events, heightBonusCoins(s.height));
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
