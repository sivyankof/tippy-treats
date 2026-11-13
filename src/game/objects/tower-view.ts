import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import type { LayerPlan, PlacedLayer, TowerState } from '../../core/tower-sim';
import { wobbleOffset } from '../../core/wobble';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { KITCHEN_COLORS } from '../../data/palette';
import { frameLerp } from '../../util/math';
import { DEPTH } from '../depth';
import { effectsMode } from '../effects-mode';
import { waveSquash } from '../fx/anim-curves';
import { bakeTexture } from '../ui/bake-texture';
import { moodForWobble, type MouthKind, type Reaction } from './face-state';
import { LayerView } from './layer-view';

const TRAY_TEXTURE = 'tray';
const TRAY_SHADOW_WIDTH_RATIO = 1.04;
/** The frozen sway counts as caught up with the simulation below this share. */
const HOLD_EPSILON = 0.01;
const PLAIN_LOOK: LayerPlan = { kind: 'plain' };

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

  /** Sway shown last frame, per layer: the pose the tower holds while it is frozen. */
  private readonly shownOffsets = new Map<number, number>();
  private heldOffsets: Map<number, number> | null = null;
  private holdMs = 0;
  /** 1 while frozen, then fades to 0 as the sway catches up with the simulation. */
  private holdBlend = 0;

  private lookTarget: { x: number; y: number } | null = null;
  private topMouthHint: MouthKind | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    /** World y of the tray surface. */
    readonly trayTopY: number,
  ) {
    this.drawTray();
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

  /** The view of the top layer, if it is drawn. */
  topView(): LayerView | null {
    return this.active.get(this.layerCount - 1) ?? null;
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
    const count = Math.min(state.layers.length, this.hiddenFrom);
    this.layerCount = count;
    const offscreen = Math.floor((this.trayTopY - cameraBottomY) / BALANCE.layer.height);
    const firstVisible = Math.max(0, offscreen - ANIM.pool.offscreenMarginLayers);
    const first = Math.min(Math.max(firstVisible, count - ANIM.pool.maxLiveLayers), count - 1);

    for (const [index, view] of this.active) {
      if (index < first || index >= count) this.release(index, view);
    }

    this.shownOffsets.clear();
    for (let i = Math.max(first, 0); i < count; i++) {
      const layer = state.layers[i];
      if (!layer) continue;
      const view = this.active.get(i) ?? this.acquire(i);
      const offset = this.swayOffset(state, i);
      this.shownOffsets.set(i, offset);
      const pose = this.fillPose(this.scratchPose, layer, i, offset);
      view.setLayer(i + 1, pose.width, pose.cut).setLook(pose.look);
      view.setPosition(pose.x, pose.y).setAngle(pose.angle);
      if (i === count - 1) this.updateTopSpan(pose.x, pose.width);
    }
    if (count === 0) this.updateTopSpan(BALANCE.tray.centerX, BALANCE.tray.width);
  }

  /** Advances the sway freeze and the faces: mood, eyes trailing the sway, gaze, blinking. */
  tick(dtMs: number): void {
    const state = this.state;
    if (!state) return;
    this.advanceFreeze(dtMs);
    const mood = moodForWobble(state.wobble);
    const top = this.layerCount - 1;
    const { swayEyeLag, swayEyeMax } = ANIM.face;
    for (const [index, view] of this.active) {
      const face = view.faceView;
      const drift = mood === 'calm' ? 0 : -(this.shownOffsets.get(index) ?? 0) * swayEyeLag;
      face.setMood(mood);
      face.setMouthHint(index === top ? this.topMouthHint : undefined);
      face.setPupilDrift(Math.max(-swayEyeMax, Math.min(swayEyeMax, drift)));
      const target = this.lookTarget;
      face.lookAt(target ? target.x - view.x : 0, target ? target.y - view.y : 0);
      view.tick(dtMs);
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
   * The top layer squashes, then the layers below follow with a weaker, delayed wave.
   * "Fewer effects" keeps only the squash of the top layer.
   */
  playLanding(): void {
    this.topView()?.playLanding();
    if (effectsMode.reduced) return;
    for (let k = 1; k <= ANIM.wave.layers; k++) {
      const view = this.active.get(this.layerCount - 1 - k);
      if (!view) break;
      const wave = waveSquash(k);
      view.playLanding(wave.scaleX, wave.scaleY, wave.delayMs);
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
  freeze(ms: number): void {
    this.heldOffsets = new Map(this.shownOffsets);
    this.holdMs = ms;
    this.holdBlend = 1;
  }

  /** Stops drawing the layers from this 0-based index up. */
  hideFrom(index: number): void {
    this.hiddenFrom = Math.min(this.hiddenFrom, Math.max(0, index));
  }

  private swayOffset(state: Readonly<TowerState>, index: number): number {
    const live = wobbleOffset(state.wobble, state.wobblePhase, state.layers.length - 1 - index);
    if (this.holdBlend <= 0 || !this.heldOffsets) return live;
    // A layer that landed in the frozen step has no held pose of its own: it rides on the layer below.
    const held = this.heldOffsets.get(index) ?? this.heldOffsets.get(index - 1);
    if (held === undefined) return live;
    return live + (held - live) * this.holdBlend;
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

  private advanceFreeze(dtMs: number): void {
    if (this.holdMs > 0) {
      this.holdMs -= dtMs;
      return;
    }
    if (this.holdBlend <= 0) return;
    this.holdBlend *= 1 - frameLerp(ANIM.sneeze.catchUpLerp, dtMs);
    if (this.holdBlend < HOLD_EPSILON) {
      this.holdBlend = 0;
      this.heldOffsets = null;
    }
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

  private drawTray(): void {
    const { thickness, radius, outline, shadowHeight, shadowAlpha } = ANIM.tray;
    const w = BALANCE.tray.width;
    const texW = 2 * Math.ceil((w * TRAY_SHADOW_WIDTH_RATIO) / 2);
    const texH = thickness + shadowHeight;
    const left = (texW - w) / 2;
    bakeTexture(this.scene, TRAY_TEXTURE, texW, texH, (g) => {
      g.fillStyle(KITCHEN_COLORS.trayShadow, shadowAlpha);
      g.fillEllipse(texW / 2, thickness + shadowHeight / 3, texW, shadowHeight);
      g.fillStyle(KITCHEN_COLORS.trayShadow, 1);
      g.fillRoundedRect(left, 0, w, thickness, radius);
      g.fillStyle(KITCHEN_COLORS.tray, 1);
      g.fillRoundedRect(
        left + outline / 2,
        outline / 2,
        w - outline,
        thickness - outline * 1.5,
        radius - outline / 2,
      );
    });
    this.scene.add
      .image(BALANCE.tray.centerX, this.trayTopY, TRAY_TEXTURE)
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.tray);
  }
}
