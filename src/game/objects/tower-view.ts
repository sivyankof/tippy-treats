import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import type { LayerPlan, PlacedLayer, TowerState } from '../../core/tower-sim';
import { wobbleAmplitude, wobbleOffset } from '../../core/wobble';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { DEPTH } from '../depth';
import { effectsMode } from '../effects-mode';
import { waveStep } from '../fx/anim-curves';
import { moodForWobble, type MouthKind, type Reaction } from './face-state';
import { GlazeDripGrowth, type DropHandler } from './glaze-drip-growth';
import { LickDirector, type LickContext } from './lick-director';
import { isAiming } from './lick-plan';
import { plainLooks } from './plain-look';
import { LayerView } from './layer-view';
import { SwayHold } from './sway-hold';
import { Tray } from './tray';

const PLAIN_LOOK: LayerPlan = { kind: 'plain' };

/** Phase step between neighbouring layers, so their material motion does not run in step (radians). */
const MATERIAL_PHASE_STEP = 2.4;

/** Where a placed layer is drawn: sway included. */
export interface LayerPose {
  x: number;
  y: number;
  width: number;
  /** Sway rotation in degrees. */
  angle: number;
  /** Bitten edge, if the layer was cut when it landed. */
  cut: CutSide | null;
  /** What the layer is (the placed layer itself: do not keep or change it). */
  look: LayerPlan;
}

/**
 * The tray and the placed layers. Positions and widths come from the sim state
 * every frame; only the top few layers get a view, deeper ones go back to a pool.
 */
export class TowerView {
  private readonly active = new Map<number, LayerView>();
  private readonly pool: LayerView[] = [];
  /** Presentation memory: the bitten edge of each placed layer (0-based). */
  private readonly cuts: Array<CutSide | null> = [];
  private state: Readonly<TowerState> | null = null;
  private layerCount = 0;
  /** Layers from this index up are not drawn (the tower is collapsing). */
  private hiddenFrom = Infinity;
  private topViewXValue: number = BALANCE.tray.centerX;
  private readonly span = {
    left: BALANCE.tray.centerX - BALANCE.tray.width / 2,
    right: BALANCE.tray.centerX + BALANCE.tray.width / 2,
  };
  /** Reused by `sync` for every layer, so a frame allocates no poses. */
  private readonly scratchPose: LayerPose = {
    x: 0,
    y: 0,
    width: 0,
    angle: 0,
    cut: null,
    look: PLAIN_LOOK,
  };

  /** The sway the tower holds during a freeze. */
  private readonly sway = new SwayHold();

  /** Clock of the material motion. */
  private clockMs = 0;
  private readonly motion = { timeMs: 0, swayShare: 0, phase: 0 };

  private readonly tray: Tray;
  private readonly glazeGrowth = new GlazeDripGrowth();
  /** The rare lick of a plain layer; it draws from the cosmetic stream of the run. */
  readonly licks = new LickDirector(plainLooks.cosmeticSeed);
  private bandTop = -Infinity;
  private bandBottom = Infinity;
  private calm = true;
  private lookTarget: { x: number; y: number } | null = null;
  private topMouthHint: MouthKind | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    /** World y of the tray surface. */
    readonly trayTopY: number,
  ) {
    this.tray = new Tray(scene, trayTopY);
  }

  /** World centre y of the layer with the given 0-based index. */
  layerCenterY(index: number): number {
    return this.trayTopY - (index + 0.5) * BALANCE.layer.height;
  }

  /** World y of the top surface of the tower. */
  topY(): number {
    return this.trayTopY - this.layerCount * BALANCE.layer.height;
  }

  /** Current centre x of the top layer including sway, or the tray centre. */
  topViewX(): number {
    return this.topViewXValue;
  }

  /**
   * Horizontal extent of the top layer (the tray when the tower is empty), sway included.
   * The object is reused and updated by `sync`: read it at once, do not keep it.
   */
  topSpan(): Readonly<{ left: number; right: number }> {
    return this.span;
  }

  /** Where the drops that fall from grown glaze drips go (`null`: none fall). */
  setGlazeDropHandler(handler: DropHandler | null): void {
    this.glazeGrowth.onDrop = handler
      ? (x, y, color) => {
          handler(x, y, color);
          this.licks.noteDrop(x, y, this.clockMs);
        }
      : null;
  }

  /** The part of the world the screen shows (world y): only layers inside it lick. */
  setScreenBand(top: number, bottom: number): void {
    this.bandTop = top;
    this.bandBottom = bottom;
  }

  /** Makes a plain layer lick a drip right away (a dev tool); returns whether one could. */
  lickNow(): boolean {
    return this.licks.lickNow(this.lickContext());
  }

  private lickContext(): LickContext {
    return {
      views: this.active,
      topIndex: this.layerCount - 1,
      calm: this.calm,
      aiming: this.state !== null && isAiming(this.state.phase, this.state.flying !== null),
      bandTop: this.bandTop,
      bandBottom: this.bandBottom,
      nowMs: this.clockMs,
    };
  }

  /** The view of the top layer, if it is drawn. */
  topView(): LayerView | null {
    return this.active.get(this.layerCount - 1) ?? null;
  }

  /** Every drawn layer view with its 0-based index. */
  views(): IterableIterator<[number, LayerView]> {
    return this.active.entries();
  }

  /** The view of a placed layer (0-based index), if it is drawn. */
  viewAt(index: number): LayerView | null {
    return this.active.get(index) ?? null;
  }

  /** Remembers which edge of the layer (0-based) was bitten; `null` for an intact one. */
  noteCut(index: number, side: CutSide | null): void {
    this.cuts[index] = side;
  }

  /** Pose of a placed layer as of the last `sync`. */
  layerPose(index: number): LayerPose | null {
    const layer = this.state?.layers[index];
    if (!this.state || !layer) return null;
    return this.fillPose(
      { x: 0, y: 0, width: 0, angle: 0, cut: null, look: PLAIN_LOOK },
      layer,
      index,
      this.swayOffset(this.state, index),
    );
  }

  /**
   * Places the views. `cameraBottomY` is the world y of the bottom screen edge:
   * layers fully below it are returned to the pool.
   */
  sync(state: Readonly<TowerState>, cameraBottomY: number): void {
    this.state = state;
    this.glazeGrowth.noteLayers(state.layers.length, this.clockMs);
    const count = Math.min(state.layers.length, this.hiddenFrom);
    this.layerCount = count;
    const offscreen = Math.floor((this.trayTopY - cameraBottomY) / BALANCE.layer.height);
    const firstVisible = Math.max(0, offscreen - ANIM.pool.offscreenMarginLayers);
    const first = Math.min(Math.max(firstVisible, count - ANIM.pool.maxLiveLayers), count - 1);

    for (const [index, view] of this.active) {
      if (index < first || index >= count) this.release(index, view);
    }

    this.sway.beginFrame();
    for (let i = Math.max(first, 0); i < count; i++) {
      const layer = state.layers[i];
      if (!layer) continue;
      const view = this.active.get(i) ?? this.acquire(i);
      const offset = this.swayOffset(state, i);
      this.sway.note(i, offset);
      const pose = this.fillPose(this.scratchPose, layer, i, offset);
      view.setLook(pose.look).setLayer(i + 1, pose.width, pose.cut);
      view.setPosition(pose.x + view.slideX, pose.y).setAngle(pose.angle * view.material.tilt);
      if (i === count - 1) this.updateTopSpan(pose.x, pose.width);
    }
    if (count === 0) this.updateTopSpan(BALANCE.tray.centerX, BALANCE.tray.width);
  }

  /** Advances the sway freeze and the faces: mood, eyes trailing the sway, gaze, blinking. */
  tick(dtMs: number): void {
    const state = this.state;
    if (!state) return;
    this.sway.advance(dtMs);
    this.clockMs += dtMs;
    this.tray.tick(this.clockMs);
    this.motion.timeMs = this.clockMs;
    this.motion.swayShare = wobbleAmplitude(state.wobble) / BALANCE.wobble.amplitudeMax;
    const mood = moodForWobble(state.wobble);
    this.calm = mood === 'calm';
    const top = this.layerCount - 1;
    const { swayEyeLag, swayEyeMax } = ANIM.face;
    for (const [index, view] of this.active) {
      const face = view.faceView;
      const drift = mood === 'calm' ? 0 : -this.sway.shownOffset(index) * swayEyeLag;
      face.setMood(mood);
      face.setMouthHint(index === top ? this.topMouthHint : undefined);
      face.setPupilDrift(Math.max(-swayEyeMax, Math.min(swayEyeMax, drift)));
      const target = this.lookTarget;
      face.lookAt(target ? target.x - view.x : 0, target ? target.y - view.y : 0);
      this.motion.phase = index * MATERIAL_PHASE_STEP;
      view.tick(dtMs, this.motion);
    }
    if (this.hiddenFrom === Infinity) {
      this.glazeGrowth.tick(this.active, state, this.clockMs, dtMs);
      this.licks.update(dtMs, this.lickContext());
    } else {
      this.licks.stop();
    }
  }

  /** Every drawn face looks at the world point; `undefined` makes them look straight ahead. */
  setLookTarget(x?: number, y?: number): void {
    this.lookTarget = x === undefined || y === undefined ? null : { x, y };
  }

  /** Mouth shape of the top layer while it waits for the flying one (`undefined`: its own). */
  setTopMouthHint(hint: MouthKind | undefined): void {
    this.topMouthHint = hint;
  }

  /** Every drawn face makes the same expression for `ms`. */
  reactAll(reaction: Reaction, ms: number): void {
    for (const view of this.active.values()) view.faceView.react(reaction, ms);
  }

  /**
   * The top layer squashes, then the layers below follow with a weaker, delayed wave; each one
   * squashes the way its material does, `waveMul` makes the wave stronger (a heavy layer).
   * "Fewer effects" keeps only the squash of the top layer.
   */
  playLanding(waveMul = 1): void {
    this.topView()?.playImpact();
    if (effectsMode.reduced) return;
    for (let k = 1; k <= ANIM.wave.layers; k++) {
      const view = this.active.get(this.layerCount - 1 - k);
      if (!view) break;
      const wave = waveStep(k);
      view.playImpact(wave.strength * waveMul, wave.delayMs);
    }
  }

  /** Quick squash of the top layer when the tower sneezes; every face squints. */
  squashTop(): void {
    this.topView()?.playSqueeze(ANIM.sneeze.squashScale, ANIM.sneeze.durationMs);
    this.reactAll('squint', ANIM.sneeze.durationMs);
  }

  /**
   * The sway stands still for `ms` (a sneeze), using the pose of the last frame.
   * Call it before the `sync` that follows the sim step that caused it.
   */
  freeze(ms: number, catchUpLerp: number = ANIM.sneeze.catchUpLerp): void {
    this.sway.freeze(ms, catchUpLerp);
  }

  /** Stops drawing the layers from this 0-based index up. */
  hideFrom(index: number): void {
    this.hiddenFrom = Math.min(this.hiddenFrom, Math.max(0, index));
  }

  private swayOffset(state: Readonly<TowerState>, index: number): number {
    const live = wobbleOffset(state.wobble, state.wobblePhase, state.layers.length - 1 - index);
    return this.sway.apply(index, live);
  }

  /** Fills `out` with where a placed layer is drawn; returns it. */
  private fillPose(out: LayerPose, layer: PlacedLayer, index: number, offset: number): LayerPose {
    out.x = layer.x + offset;
    out.y = this.layerCenterY(index);
    out.width = layer.width;
    out.angle = ANIM.sway.maxRotationDeg * (offset / BALANCE.wobble.amplitudeMax);
    out.cut = this.cuts[index] ?? null;
    out.look = layer;
    return out;
  }

  private updateTopSpan(x: number, width: number): void {
    this.topViewXValue = x;
    this.span.left = x - width / 2;
    this.span.right = x + width / 2;
  }

  private acquire(index: number): LayerView {
    const view = this.pool.pop() ?? new LayerView(this.scene);
    // The depth follows the index, so a view acquired for a lower layer (during the collapse)
    // still draws under the layers above it.
    view
      .resetAnim()
      .setDepth(DEPTH.tower + index * DEPTH.towerLayerStep)
      .setVisible(true)
      .setActive(true);
    this.active.set(index, view);
    return view;
  }

  private release(index: number, view: LayerView): void {
    view.resetAnim().setVisible(false).setActive(false);
    this.active.delete(index);
    this.pool.push(view);
  }
}
