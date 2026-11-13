import type * as Phaser from 'phaser';
import type { FlyingLayer, SimEvent, TowerState } from '../../core/tower-sim';
import type { RunResult } from '../../core/run-result';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
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
import { TowerCollapse } from './tower-collapse';

/** The flying layer as it was before the sim step that just ran. */
export type FlyingMemo = Pick<FlyingLayer, 'x' | 'width' | 'index'>;
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
          break;
        case 'miss':
          this.onMiss(memo, land !== undefined);
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

    if (perfect) {
      top?.playGlossSweep();
      this.tower.reactAll('joy', ANIM.perfect.joyMs);
    } else if (event.cutSide && event.cutWidth > 0 && memo) {
      top?.faceView.react('ouch', ANIM.bite.ouchMs);
      this.biteOff(event, event.cutSide, memo, state.layers.length - 1);
    }

    const glowing = state.combo >= ANIM.combo.glowFrom;
    if (perfect && glowing) this.glow.flash();
    this.setGlow(glowing);
  }

  private onCombo(widened: number, state: Readonly<TowerState>): void {
    const layer = state.layers.at(-1);
    if (widened > 0 && layer) this.tower.topView()?.playWiden(layer.width - widened);
  }

  private onMiss(memo: FlyingMemo | null, followedLanding: boolean): void {
    this.setGlow(false);
    // A sneeze that leaves too little cake follows a landing: nothing falls past the tower.
    if (!memo || followedLanding) {
      this.missWaitMs = ANIM.miss.reactMs;
      return;
    }
    const side = memo.x >= this.tower.topViewX() ? 1 : -1;
    this.missPiece = this.pieces.spawn({
      layerIndex: memo.index,
      x: memo.x,
      y: this.tower.layerCenterY(memo.index - 1),
      width: memo.width,
      cut: null,
      ...driftMotion(ANIM.miss, side),
      face: 'horror',
    });
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
      layerIndex: memo.index,
      x: memo.x + side * (memo.width / 2 - event.cutWidth / 2),
      y,
      width: event.cutWidth,
      // The sponge faces the tower, which is the opposite side of the cut.
      cut: side === 1 ? 'left' : 'right',
      ...driftMotion(ANIM.bite, side),
      face: null,
    });

    const pose = this.tower.layerPose(index);
    if (!pose) return;
    const { dripSize, drips } = ANIM.bite;
    const edgeX = pose.x + side * (pose.width / 2);
    const startY = y - BALANCE.layer.height / 2 + BALANCE.layer.height * ANIM.layer.glazeDepth;
    const glaze = layerColors(colorIndexFor(memo.index)).glaze;
    const count = pickInt(drips);
    for (let k = 0; k < count; k++) {
      const inset = Math.min(ANIM.layer.outline + dripSize / 2 + k * dripSize * 2, pose.width / 2);
      this.drips.spawn(edgeX - side * inset, startY - dripSize, glaze);
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
