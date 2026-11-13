import type * as Phaser from 'phaser';
import type { FlyingLayer, SimEvent, TowerState } from '../../core/tower-sim';
import type { RunResult } from '../../core/run-result';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { services } from '../../services';
import { pickInt } from '../../util/math';
import { aimMouth } from '../objects/face-state';
import { FlyingLayerView } from '../objects/flying-layer-view';
import { colorIndexFor, layerColors } from '../objects/layer-art';
import type { LayerView } from '../objects/layer-view';
import { TowerView } from '../objects/tower-view';
import { driftMotion } from './anim-curves';
import { CameraKick } from './camera-kick';
import { ComboGlow } from './combo-glow';
import { FallingPieces } from './falling-piece';
import { GlazeDrip } from './glaze-drip';
import { LandingFx } from './landing-fx';
import { cuesForEvents, playCues } from './run-cues';
import { TowerCollapse } from './tower-collapse';

/** The flying layer as it was before the sim step that just ran. */
export type FlyingMemo = Pick<FlyingLayer, 'x' | 'width' | 'kind' | 'creature' | 'level'>;
type LandEvent = Extract<SimEvent, { type: 'land' }>;

/** The camera as the effects need it: world scroll without the kick, and the screen size. */
export interface CameraInfo {
  scrollY: number;
  /** Scroll that shows the tray, where the collapse ends. */
  trayScrollY: number;
  width: number;
  height: number;
}

/**
 * Everything the player sees happen around the run: it turns sim events into
 * animations on the tower, the flying layer, debris, drops, camera kick and glow,
 * and runs the miss reaction and the collapse that end a run.
 */
export class RunFx {
  readonly tower: TowerView;
  private readonly flyingView: FlyingLayerView;
  private readonly pieces: FallingPieces;
  private readonly drips: GlazeDrip;
  private readonly kick = new CameraKick();
  private readonly glow: ComboGlow;
  private readonly landingFx: LandingFx;

  private glowOn = false;
  private missPiece: LayerView | null = null;
  /** Time left of the miss reaction; `null` when no miss is waiting. */
  private missWaitMs: number | null = null;
  private result: RunResult | null = null;
  private collapse: TowerCollapse | null = null;
  private resultsWaitMs: number = ANIM.results.delayMs;
  private resultsDelivered = false;

  constructor(scene: Phaser.Scene, trayTopY: number) {
    this.tower = new TowerView(scene, trayTopY);
    this.flyingView = new FlyingLayerView(scene, this.tower);
    this.pieces = new FallingPieces(scene);
    this.drips = new GlazeDrip(scene);
    this.glow = new ComboGlow(scene);
    this.landingFx = new LandingFx(scene);
  }

  /** The miss has played out: the run may be declined. */
  get canDecline(): boolean {
    return this.missWaitMs !== null && this.missWaitMs <= 0;
  }

  /** Scroll the collapse wants the camera to have; `null` outside of it. */
  get collapseScroll(): number | null {
    return this.collapse ? this.collapse.scrollY : null;
  }

  /** Push of the view in pixels, positive is down. */
  get cameraOffset(): number {
    return this.kick.offset;
  }

  /** The result once the collapse and the pause after it are over, then never again. */
  takeResult(): RunResult | null {
    if (this.resultsDelivered || !this.result || !this.collapse?.done) return null;
    if (this.resultsWaitMs > 0) return null;
    this.resultsDelivered = true;
    return this.result;
  }

  resize(width: number, height: number): void {
    this.glow.resize(width, height);
  }

  /** Reacts to the events of one sim step. `memo` is the flying layer before that step. */
  handleEvents(
    events: readonly SimEvent[],
    state: Readonly<TowerState>,
    memo: FlyingMemo | null,
    cam: CameraInfo,
  ): void {
    if (events.length === 0) return;
    playCues(cuesForEvents(events, state, memo), services);
    const land = events.find((e): e is LandEvent => e.type === 'land');
    if (land) this.tower.noteCut(state.layers.length - 1, land.cutSide);
    // The sway of the frame before the sneeze is the one the tower holds.
    if (events.some((e) => e.type === 'wobble_sneeze')) this.tower.freeze(ANIM.sneeze.freezeMs);
    // Landings need the view of the new layer, which normally appears on the next sync.
    if (land) this.tower.sync(state, cam.scrollY + cam.height);

    for (const event of events) {
      switch (event.type) {
        case 'spawn':
          this.missWaitMs = null;
          break;
        case 'land':
          this.onLand(event, state, memo);
          break;
        case 'combo':
          this.onCombo(event.widened, state);
          break;
        case 'wobble_sneeze':
          this.tower.squashTop();
          this.onSneeze(state);
          break;
        case 'miss':
          this.onMiss(event.shielded, memo, land !== undefined, state);
          break;
        case 'run_over':
          this.result = event.result;
          break;
        default:
          break;
      }
    }
  }

  /** Per frame: places everything and advances the effects. */
  update(dtMs: number, timeMs: number, state: Readonly<TowerState>, cam: CameraInfo): void {
    this.advanceEnd(dtMs, state, cam);

    this.tower.sync(state, cam.scrollY + cam.height);
    this.flyingView.sync(state, timeMs, dtMs);
    this.pointFaces(state);
    this.tower.tick(dtMs);

    this.pieces.update(dtMs);
    this.drips.update(dtMs);
    this.landingFx.update(dtMs);
    this.kick.update(dtMs);
    this.placeGlow(timeMs, cam);
  }

  private onLand(event: LandEvent, state: Readonly<TowerState>, memo: FlyingMemo | null): void {
    const perfect = event.quality === 'perfect';
    const top = this.tower.topView();
    this.tower.playLanding();
    top?.faceView.react('blink', ANIM.face.blinkMs);
    const { drop, perfectBump, durationMs } = ANIM.cameraKick;
    this.kick.kick(perfect ? -perfectBump : drop, durationMs);

    const index = state.layers.length - 1;
    const pose = this.tower.layerPose(index);
    if (pose) this.landingFx.landed(pose);

    if (perfect) {
      if (pose) this.landingFx.perfect(pose, state.combo);
      top?.playGlossSweep();
      this.tower.reactAll('joy', ANIM.perfect.joyMs);
    } else if (event.cutSide && event.cutWidth > 0 && memo) {
      top?.faceView.react('ouch', ANIM.bite.ouchMs);
      this.biteOff(event, event.cutSide, memo, index);
    }

    const glowing = state.combo >= ANIM.combo.glowFrom;
    if (perfect && glowing) this.glow.flash();
    this.setGlow(glowing);
  }

  /** Crumbs fly out of both sides of the top layer. */
  private onSneeze(state: Readonly<TowerState>): void {
    const index = state.layers.length - 1;
    const pose = this.tower.layerPose(index);
    if (pose) this.landingFx.sneezed(pose, layerColors(colorIndexFor(index + 1)).cake);
  }

  private onCombo(widened: number, state: Readonly<TowerState>): void {
    const layer = state.layers.at(-1);
    if (widened > 0 && layer) this.tower.topView()?.playWiden(layer.width - widened);
  }

  /**
   * A shielded miss only drops the layer: the run goes on and the sim brings the layer back,
   * so no miss wait starts and no result is expected. An unshielded one ends the run.
   */
  private onMiss(
    shielded: boolean,
    memo: FlyingMemo | null,
    followedLanding: boolean,
    state: Readonly<TowerState>,
  ): void {
    this.setGlow(false);
    // A sneeze that leaves too little cake follows a landing: nothing falls past the tower.
    if (!memo || followedLanding) {
      if (!shielded) this.missWaitMs = ANIM.miss.reactMs;
      return;
    }
    const side = memo.x >= this.tower.topViewX() ? 1 : -1;
    // The missed layer would have been the next one in the tower: twins do not shift it.
    const piece = this.pieces.spawn({
      layerIndex: state.layers.length + 1,
      x: memo.x,
      y: this.tower.layerCenterY(state.layers.length),
      width: memo.width,
      cut: null,
      ...driftMotion(ANIM.miss, side),
      face: 'horror',
      look: memo,
    });
    if (shielded) return;
    this.missPiece = piece;
    this.missWaitMs = ANIM.miss.fallMs + ANIM.miss.reactMs;
  }

  /** The bitten-off part falls away, a glaze drop runs down the cut edge. */
  private biteOff(
    event: LandEvent,
    cutSide: 'left' | 'right',
    memo: FlyingMemo,
    index: number,
  ): void {
    const side = cutSide === 'right' ? 1 : -1;
    const y = this.tower.layerCenterY(index);
    this.pieces.spawn({
      layerIndex: index + 1,
      x: memo.x + side * (memo.width / 2 - event.cutWidth / 2),
      y,
      width: event.cutWidth,
      // The sponge faces the tower, which is the opposite side of the cut.
      cut: side === 1 ? 'left' : 'right',
      ...driftMotion(ANIM.bite, side),
      face: null,
      look: memo,
    });

    const pose = this.tower.layerPose(index);
    if (!pose) return;
    const edgeX = pose.x + side * (pose.width / 2);
    const colors = layerColors(colorIndexFor(index + 1));
    this.landingFx.bitten(edgeX, y, side, colors.cake);
    const { dripSize, drips } = ANIM.bite;
    const startY = y - BALANCE.layer.height / 2 + BALANCE.layer.height * ANIM.layer.glazeDepth;
    const count = pickInt(drips);
    for (let k = 0; k < count; k++) {
      const inset = Math.min(ANIM.layer.outline + dripSize / 2 + k * dripSize * 2, pose.width / 2);
      this.drips.spawn(edgeX - side * inset, startY - dripSize, colors.glaze);
    }
  }

  /** The miss wait, then the collapse, then the pause before the results. */
  private advanceEnd(dtMs: number, state: Readonly<TowerState>, cam: CameraInfo): void {
    if (this.missWaitMs !== null && this.missWaitMs > 0) {
      this.missWaitMs -= dtMs;
      if (this.missWaitMs <= 0) this.missPiece = null;
    }
    if (this.result && !this.collapse && (this.missWaitMs ?? 0) <= 0) {
      this.setGlow(false);
      this.collapse = new TowerCollapse({
        tower: this.tower,
        pieces: this.pieces,
        count: state.layers.length,
        startScroll: cam.scrollY,
        endScroll: cam.trayScrollY,
        onDrop: (seriesIndex) => services.audio.collapseThud(seriesIndex),
      });
    }
    if (!this.collapse) return;
    this.collapse.update(dtMs);
    if (this.collapse.done) this.resultsWaitMs -= dtMs;
  }

  /** Where every face looks, and which top mouth to make. */
  private pointFaces(state: Readonly<TowerState>): void {
    const flying = this.flyingView.position();
    if (flying) this.tower.setLookTarget(flying.x, flying.y);
    else if (this.missPiece) this.tower.setLookTarget(this.missPiece.x, this.missPiece.y);
    else this.tower.setLookTarget();

    const span = this.tower.topSpan();
    const aimed =
      state.flying !== null &&
      this.tower.topView() !== null &&
      aimMouth(state.flying.x - this.tower.topViewX(), span.right - span.left) === 'open';
    this.tower.setTopMouthHint(aimed ? 'yum' : undefined);
  }

  private setGlow(on: boolean): void {
    if (on === this.glowOn) return;
    this.glowOn = on;
    this.glow.setActive(on);
  }

  /** Keeps the halo behind the visible part of the tower (screen coordinates). */
  private placeGlow(timeMs: number, cam: CameraInfo): void {
    const top = Math.max(0, this.tower.topY() - cam.scrollY);
    const bottom = Math.min(cam.height, this.tower.trayTopY + ANIM.tray.thickness - cam.scrollY);
    const height = Math.max(BALANCE.layer.height, bottom - top);
    this.glow.update(timeMs, BALANCE.tray.centerX, (top + bottom) / 2, height, BALANCE.tray.width);
  }
}
