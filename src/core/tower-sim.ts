import { BALANCE } from '../data/tower/balance';
import { ZONES } from '../data/zones/zones';
import { collectModifiers, dropModifiers } from './abilities/modifiers';
import { runAbility, runCloudHooks, runLandingHooks, tickRunEffects } from './abilities/run';
import type { Modifiers } from './abilities/types';
import { layerSpeed, resolveDrop, type DropInput } from './drop';
import { growInField } from './field';
import { Flight, newFlyingLayer } from './flight';
import { applyContinue, applyMiss } from './miss';
import { Rng } from './rng';
import { collectFloatingCoin, payHeightBonus, payLanding, spawnFloatingCoin } from './run-coins';
import type { RunEndReason, RunResult } from './run-result';
import { comboWidening, nextCombo, normalScore, perfectScore } from './scoring';
import {
  newLandingPreview,
  type FlyingLayer,
  type LandingPreview,
  type PlacedLayer,
  type RunConfig,
  type SimEvent,
  type SimPhase,
  type TowerState,
} from './sim-types';
import { layerZoneScoreMult, spaceWidthLimit } from './space-laps';
import { TempoEase } from './tempo-ease';
import { attemptLayer, type LayerAttempt, type PlanState } from './team-queue';
import { cloudRoll, layerRules, zoneIndexOf } from './zones';
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
  CoinSource,
  FlyingLayer,
  LandQuality,
  LayerKind,
  LandingPreview,
  LayerPlan,
  PlacedLayer,
  RunConfig,
  SimEvent,
  SpeedScaleContext,
  SimPhase,
  TeamSlot,
  TowerState,
} from './sim-types';
export { newLandingPreview } from './sim-types';

const STEP_MS = BALANCE.sim.stepMs;

/**
 * The tower a run starts on: `height` plain perfect layers centred on the tray, narrowing evenly
 * from the first width down to `topWidth` (the start width of a checkpoint).
 */
export function prebuiltTower(height: number, topWidth?: number): PlacedLayer[] {
  const { firstWidth, maxWidth } = BALANCE.layer;
  const top = Math.min(maxWidth, Math.max(BALANCE.drop.missMargin, topWidth ?? firstWidth));
  return Array.from({ length: height }, (_, i) => ({
    x: BALANCE.tray.centerX,
    width: height === 1 ? top : Math.round(firstWidth + ((top - firstWidth) * i) / (height - 1)),
    kind: 'plain' as const,
    quality: 'perfect' as const,
  }));
}
/** Absorbs floating point drift so a frame of exactly N steps always runs N steps. */
const STEP_EPSILON_MS = 1e-6;

/** State machine of a single run. Knows nothing about the screen. */
export class TowerSim {
  protected readonly rng: Rng;
  private readonly coinRng: Rng;
  private readonly zonesRng: Rng;
  private readonly config: RunConfig;
  private readonly s: TowerState;
  private accumulatorMs = 0;
  private elapsedMs = 0;
  private perfects = 0;
  /** Width of the next layer to spawn. */
  private nextWidth: number = BALANCE.layer.firstWidth;
  private endReason: RunEndReason = 'miss';
  /** Layers placed before the run began (checkpoint or debug start); they earn nothing. */
  private readonly startHeight: number;
  private planState: PlanState;
  /** The layer being attempted; a retry (shield, continue) of the same index keeps it. */
  private attempt: LayerAttempt | null = null;
  /** Motion of the flying layer; `null` outside the flying phase. */
  private flight: Flight | null = null;
  /** Streak reward: slower layers after a run of perfects. */
  private readonly tempoEase = new TempoEase();
  /** The landing worked out for the layer in the fall; it cannot change until that layer lands. */
  private readonly landingMemo = newLandingPreview();
  /** The falling layer `landingMemo` was made for, `null` when there is none. */
  private landingMemoFor: FlyingLayer | null = null;
  /** The memo is a landing (true) or a miss (false). */
  private landingMemoHit = false;

  constructor(config: RunConfig) {
    this.config = config;
    this.rng = new Rng(config.seed);
    this.coinRng = this.rng.fork('coins');
    this.zonesRng = this.rng.fork('zones');
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
      shieldLevel: 0,
      tempoLeft: 0,
      widthCap: BALANCE.layer.maxWidth,
    };
    const startHeight = Math.max(0, Math.floor(config.startHeight ?? 0));
    this.startHeight = startHeight;
    this.s.layers.push(...prebuiltTower(startHeight, config.startWidth));
    if (startHeight > 0) this.nextWidth = this.s.layers.at(-1)?.width ?? this.nextWidth;
    this.s.height = startHeight;
    // A debug start lands straight in its zone, without a zone_change event.
    this.s.zoneIndex = zoneIndexOf(startHeight + 1);
    this.planState = { lastIndex: startHeight, goldenPending: false };
  }

  get state(): Readonly<TowerState> {
    return this.s;
  }

  /** Modifiers of the active effects: what the next drop and spawn use. */
  currentModifiers(): Readonly<Modifiers> {
    return collectModifiers(this.s.effects);
  }

  /**
   * Modifiers of the drop of the layer in the air (flying or falling): the active effects plus
   * what a creature layer gives its own drop (a rainbow layer from level 3 is not cut). Without a
   * layer in the air, the same as `currentModifiers`.
   */
  flyingModifiers(): Readonly<Modifiers> {
    const flying = this.s.flying;
    return flying ? dropModifiers(this.s.effects, flying) : this.currentModifiers();
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
    this.nextWidth = applyContinue(this.s, this.nextWidth);
    this.spawn(events);
    return events;
  }

  decline(): SimEvent[] {
    const events: SimEvent[] = [];
    if (this.s.phase === 'await_continue') this.finish(events);
    return events;
  }

  /**
   * The result of a run the player leaves before it ends: the state as it is, `endReason`
   * `quit`, `null` when the run is already over. The run is not changed. The height bonus
   * coins are paid only when a run ends by itself, so a quit run does not get them.
   */
  quitResult(): RunResult | null {
    return this.s.phase === 'over' ? null : this.buildResult('quit');
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

  /** Where the top layer will be when the fall ends: the sway keeps moving while the layer falls. */
  private topLayerXAtLanding(): number {
    const s = this.s;
    if (s.layers.length === 0) return this.topRestX();
    let { phaseMs, wobble, wobblePhase } = s;
    while (phaseMs < BALANCE.layer.fallMs) {
      phaseMs += STEP_MS;
      wobble = decayWobble(wobble, STEP_MS);
      wobblePhase = advanceWobblePhase(wobblePhase, STEP_MS);
    }
    return this.topRestX() + wobbleOffset(wobble, wobblePhase, 0);
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
      const from = events.length;
      this.flight?.step(STEP_MS, events);
      this.noteClouds(events, from);
    } else if (s.phase === 'falling') {
      if (s.phaseMs >= BALANCE.layer.fallMs) this.resolveLanding(events);
    } else if (s.phase === 'pause') {
      if (s.phaseMs >= BALANCE.layer.spawnPauseMs) this.spawn(events);
    }
  }

  /** Tells the effects about a cloud that began to cover the layer in this step. */
  private noteClouds(events: SimEvent[], from: number): void {
    for (let i = from; i < events.length; i++) {
      if (events[i]?.type === 'cloud') runCloudHooks(this.s, (event) => events.push(event));
    }
  }

  private spawn(events: SimEvent[]): void {
    const s = this.s;
    const index = s.height + 1;
    // A new index plans the layer and rolls its coin. A retry of the same index does neither.
    const planned = attemptLayer(this.attempt, index, this.config.team, this.planState);
    this.planState = planned.state;
    this.attempt = planned.attempt;
    if (planned.fresh) spawnFloatingCoin(s, events, this.coinRng, index, this.topRestX());
    const zoneIndex = zoneIndexOf(index);
    if (zoneIndex !== s.zoneIndex) {
      s.zoneIndex = zoneIndex;
      events.push({ type: 'zone_change', zoneIndex });
    }
    const rules = layerRules(this.zonesRng, index);
    const tempo = this.config.tutorial
      ? { mult: 1, started: false, left: 0 }
      : this.tempoEase.next(index, s.combo);
    s.tempoLeft = tempo.left;
    const speed =
      layerSpeed(s.height, this.currentModifiers().speedMult) *
      this.tutorialSpeedMult(index) *
      tempo.mult *
      this.analysisSpeedScale(index, zoneIndex);
    // Lap narrowing of Space: a layer wider than the cap of its lap spawns trimmed to it, evenly.
    s.widthCap = spaceWidthLimit(index);
    const width = Math.min(this.nextWidth, s.widthCap);
    const layer = newFlyingLayer(planned.attempt.plan, rules, width, speed);
    this.flight = new Flight(layer, rules.fakeoutX, (pass) =>
      cloudRoll(this.zonesRng, rules, pass),
    );
    s.flying = layer;
    this.enter('flying');
    events.push({ type: 'spawn', layer: { ...layer } });
    if (tempo.started) events.push({ type: 'tempo_ease', layers: tempo.left });
  }

  /** Analysis hook `RunConfig.speedScale`; exactly 1 when it is not set. */
  private analysisSpeedScale(index: number, zoneIndex: number): number {
    const { speedScale } = this.config;
    return speedScale
      ? speedScale({ index, height: this.s.height, zoneIndex, combo: this.s.combo })
      : 1;
  }

  /** Tutorial run: the first layers fly slower. */
  private tutorialSpeedMult(index: number): number {
    const { slowLayers, slowSpeedMult } = BALANCE.tutorial;
    return this.config.tutorial && index <= slowLayers ? slowSpeedMult : 1;
  }

  /**
   * Perfect tolerance of the next drop. A tutorial run that has placed `assistAfterLayers`
   * layers without a perfect one widens it until the first perfect drop.
   */
  private perfectTolerance(mods: Readonly<Modifiers>): number {
    const { assistAfterLayers, assistTolerance } = BALANCE.tutorial;
    const assist =
      this.config.tutorial && this.perfects === 0 && this.s.layers.length >= assistAfterLayers;
    return assist ? Math.max(mods.perfectTolerance, assistTolerance) : mods.perfectTolerance;
  }

  /** What `resolveDrop` needs to settle the flying layer on the tower. */
  private dropInput(flying: FlyingLayer, mods: Readonly<Modifiers>, targetX: number): DropInput {
    return {
      flyingX: flying.x,
      width: flying.width,
      targetX,
      perfectTolerance: this.perfectTolerance(mods),
      protectCut: mods.protectCut,
      springShare: mods.springShare,
    };
  }

  /**
   * Fills `out` with how the falling layer will land (the drop is settled the moment it is
   * dropped: the layer no longer moves) and returns true; false when no layer falls or it will
   * miss. Changes nothing in the run. Only the abilities of the landing and a sneeze can still
   * alter the width, so a view may prepare its picture from this but must cope with another one.
   * The answer is fixed once the layer drops, so it is worked out once per drop.
   */
  landingPreview(out: LandingPreview): boolean {
    const flying = this.s.flying;
    if (this.s.phase !== 'falling' || !flying) {
      this.landingMemoFor = null;
      return false;
    }
    if (this.landingMemoFor !== flying) {
      this.landingMemoFor = flying;
      this.landingMemoHit = this.computeLanding(flying, this.landingMemo);
    }
    if (!this.landingMemoHit) return false;
    Object.assign(out, this.landingMemo);
    return true;
  }

  private computeLanding(flying: FlyingLayer, out: LandingPreview): boolean {
    const outcome = resolveDrop(
      this.dropInput(flying, dropModifiers(this.s.effects, flying), this.topLayerXAtLanding()),
    );
    if (outcome.quality === 'miss') return false;
    const perfect = outcome.quality === 'perfect';
    const x = this.topRestX() + outcome.centerOffset;
    const cap = this.s.widthCap;
    const placed = growInField(x, outcome.newWidth, 0, cap);
    const widening = perfect ? comboWidening(nextCombo(this.s.combo, true), placed.width, cap) : 0;
    out.index = this.s.layers.length + 1;
    out.kind = flying.kind;
    out.creature = flying.kind === 'creature' && flying.creature ? flying.creature : null;
    out.level = out.creature ? (flying.level ?? 1) : 0;
    out.width = growInField(placed.x, placed.width, widening, cap).width;
    out.cut = outcome.cutSide;
    out.pieceWidth = outcome.cutSide ? outcome.cutWidth : 0;
    return true;
  }

  private resolveLanding(events: SimEvent[]): void {
    const s = this.s;
    const flying = s.flying;
    if (!flying) return;
    // Modifiers come from the effects that were active before this layer.
    const mods = dropModifiers(s.effects, flying);
    const outcome = resolveDrop(this.dropInput(flying, mods, this.topLayerX()));
    s.flying = null;
    this.flight = null;
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
    // A layer that came back wider than the one below (restore width) still sits inside the field.
    Object.assign(layer, growInField(layer.x, layer.width, 0, s.widthCap));
    if (flying.creature) layer.creature = flying.creature;
    if (flying.level !== undefined) layer.level = flying.level;
    s.layers.push(layer);
    s.tempoLeft = Math.max(0, s.tempoLeft - 1);
    s.height = s.layers.length + s.bonusHeight;
    events.push({
      type: 'land',
      quality: outcome.quality,
      dx: outcome.dx,
      cutWidth: outcome.cutWidth,
      cutSide: outcome.cutSide,
      newWidth: outcome.newWidth,
      savedWidth: outcome.savedWidth,
    });

    collectFloatingCoin(s, events, coinX, layer, mods);
    // Zone and ability multipliers multiply together; the zone is that of the landing layer.
    const zoneMult = layerZoneScoreMult(flying.index, ZONES[flying.zoneIndex]?.scoreMult ?? 1);
    const scoreMult = mods.scoreMult * zoneMult;
    this.score(events, layer, outcome.dx, flying.width, perfect, scoreMult);
    // What a normal drop bit off, also when the rainbow kept it (crumb counts it either way).
    const pieceWidth = outcome.cutWidth + outcome.savedWidth;
    const golden = flying.kind === 'golden';
    payLanding(s, events, golden, perfect, pieceWidth, mods);

    const emit = (event: SimEvent): number => events.push(event);
    // The shield covers the N layers after the brownie, so this layer counts with the shield
    // it had before the countdown below (a shield that runs out here still saves a sneeze here).
    const shieldedLanding = s.shield > 0;
    const landingShieldLevel = s.shieldLevel;
    const landing = { quality: layer.quality, pieceWidth, flyingWidth: flying.width, golden };
    runLandingHooks(s, emit, landing);
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
      this.miss(events, 'sneeze', shieldedLanding, landingShieldLevel);
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
    scoreMult: number,
  ): void {
    const s = this.s;
    s.combo = nextCombo(s.combo, perfect);
    if (perfect) {
      this.perfects += 1;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      const before = layer.width;
      const cap = s.widthCap;
      Object.assign(layer, growInField(layer.x, before, comboWidening(s.combo, before, cap), cap));
      const widened = layer.width - before;
      s.wobble = wobbleAfterPerfect(s.wobble);
      s.score += perfectScore(s.combo, scoreMult);
      events.push({ type: 'combo', value: s.combo, widened });
    } else {
      s.wobble = wobbleAfterNormal(s.wobble, dx, flyingWidth);
      s.score += normalScore(scoreMult);
    }
  }

  /** `shielded` defaults to the live shield; a sneeze passes the shield (and its level) of its landing. */
  private miss(
    events: SimEvent[],
    reason: RunEndReason,
    shielded = this.s.shield > 0,
    shieldLevel = this.s.shieldLevel,
  ): void {
    if (!shielded) this.endReason = reason;
    const outcome = applyMiss(
      this.s,
      events,
      this.config.mode,
      this.nextWidth,
      shielded,
      shieldLevel,
    );
    this.nextWidth = outcome.nextWidth;
    if (outcome.next === 'over') this.finish(events);
    else this.enter(outcome.next);
  }

  private finish(events: SimEvent[]): void {
    payHeightBonus(this.s, events, this.startHeight);
    this.enter('over');
    events.push({ type: 'run_over', result: this.buildResult(this.endReason) });
  }

  private buildResult(endReason: RunEndReason): RunResult {
    const s = this.s;
    return {
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
      endReason,
    };
  }
}
