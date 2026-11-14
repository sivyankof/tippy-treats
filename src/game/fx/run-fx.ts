import type * as Phaser from 'phaser';
import type { Modifiers } from '../../core/abilities/types';
import type { FlyingLayer, SimEvent, TowerState } from '../../core/tower-sim';
import type { RunResult } from '../../core/run-result';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { CONTINUE_ANIM } from '../../data/continue-anim';
import { services } from '../../services';
import { gameState } from '../../state';
import { aimMouth } from '../objects/face-state';
import { FlyingLayerView } from '../objects/flying-layer-view';
import type { LayerView } from '../objects/layer-view';
import { TowerView } from '../objects/tower-view';
import { AbilityFx } from './abilities/ability-fx';
import { CameraKick } from './camera-kick';
import { CoinFx } from './coin-fx';
import { ComboGlow } from './combo-glow';
import { DebrisFx } from './debris-fx';
import { FlyingFx } from './flying-fx';
import { LandingFx } from './landing-fx';
import { MaterialFx } from './material-fx';
import { RecordMoment } from './record-moment';
import { cuesForEvents, playCues } from './run-cues';
import { isCovered } from './rule-state';
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
  private readonly debris: DebrisFx;
  private readonly kick = new CameraKick();
  private readonly glow: ComboGlow;
  private readonly landingFx: LandingFx;
  private readonly abilityFx: AbilityFx;
  private readonly materialFx: MaterialFx;
  private readonly coinFx: CoinFx;
  private readonly flyingFx: FlyingFx;
  private readonly recordMoment: RecordMoment;

  private glowOn = false;
  private missPiece: LayerView | null = null;
  /** Time left of the miss reaction; `null` when no miss is waiting. */
  private missWaitMs: number | null = null;
  /** Real time left of the slow motion that plays the missed layer falling past. */
  private slowMoMs = 0;
  private result: RunResult | null = null;
  private collapse: TowerCollapse | null = null;
  private resultsWaitMs: number = ANIM.results.delayMs;
  private resultsDelivered = false;

  constructor(scene: Phaser.Scene, trayTopY: number) {
    this.tower = new TowerView(scene, trayTopY);
    this.flyingView = new FlyingLayerView(scene, this.tower);
    this.glow = new ComboGlow(scene);
    this.landingFx = new LandingFx(scene);
    this.debris = new DebrisFx(scene, this.tower, this.landingFx);
    this.abilityFx = new AbilityFx(scene, this.tower, this.flyingView, this.landingFx);
    this.materialFx = new MaterialFx(this.tower, this.landingFx.particles);
    this.coinFx = new CoinFx(scene, this.tower, this.landingFx.particles);
    this.flyingFx = new FlyingFx(scene, this.tower, this.flyingView, this.landingFx.particles);
    this.recordMoment = new RecordMoment(
      scene,
      this.tower,
      this.landingFx,
      this.glow,
      gameState.recordHeight,
    );
  }

  /** The miss has played out: the run may be declined. */
  get canDecline(): boolean {
    return this.missWaitMs !== null && this.missWaitMs <= 0;
  }

  /** Share of real time that the visuals run at: below 1 during the slow-motion miss. */
  get timeScale(): number {
    return this.slowMoMs > 0 ? CONTINUE_ANIM.slowMoScale : 1;
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

  /**
   * Reacts to the events of one sim step. `memo` is the flying layer and `mods` the drop
   * modifiers before that step.
   */
  handleEvents(
    events: readonly SimEvent[],
    state: Readonly<TowerState>,
    memo: FlyingMemo | null,
    mods: Readonly<Modifiers>,
    cam: CameraInfo,
  ): void {
    if (events.length === 0) return;
    playCues(cuesForEvents(events, state, memo), services);
    const land = events.find((e): e is LandEvent => e.type === 'land');
    if (land) this.tower.noteCut(state.layers.length - 1, land.cutSide);
    // The sway of the frame before the sneeze is the one the tower holds.
    if (events.some((e) => e.type === 'wobble_sneeze')) this.tower.freeze(ANIM.sneeze.freezeMs);
    this.abilityFx.beforeSync(events);
    // Landings need the view of the new layer, which normally appears on the next sync.
    if (land) this.tower.sync(state, cam.scrollY + cam.height);

    for (const event of events) {
      switch (event.type) {
        case 'spawn':
          this.missWaitMs = null;
          this.slowMoMs = 0;
          break;
        case 'land':
          this.onLand(event, state, memo);
          break;
        case 'combo':
          this.onCombo(event.widened, state);
          break;
        case 'wobble_sneeze':
          this.tower.squashTop();
          this.debris.sneeze(state);
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
    this.abilityFx.handleEvents(events, state, memo, mods, cam);
    this.coinFx.handleEvents(events, state, cam);
    this.flyingFx.handleEvents(events);
  }

  /** Per frame: places everything and advances the effects. */
  update(
    dtMs: number,
    timeMs: number,
    state: Readonly<TowerState>,
    mods: Readonly<Modifiers>,
    cam: CameraInfo,
  ): void {
    // Waits and the collapse run on real time, everything that moves on visual time.
    const realMs = dtMs;
    const visualMs = realMs * this.timeScale;
    this.slowMoMs = Math.max(0, this.slowMoMs - realMs);
    this.advanceEnd(realMs, state, cam);

    this.tower.sync(state, cam.scrollY + cam.height);
    this.flyingView.sync(state, timeMs, visualMs);
    this.flyingFx.update(visualMs, timeMs, state);
    this.coinFx.update(visualMs, timeMs, state);
    this.pointFaces(state);
    this.tower.tick(visualMs);

    this.debris.update(visualMs);
    this.landingFx.update(visualMs);
    this.materialFx.update(visualMs, state.wobble);
    this.abilityFx.update(visualMs, timeMs, state, mods, cam, this.runIsOn(state));
    this.kick.update(visualMs);
    this.recordMoment.update(visualMs, timeMs, state, cam);
    this.placeGlow(timeMs, cam);
  }

  private onLand(event: LandEvent, state: Readonly<TowerState>, memo: FlyingMemo | null): void {
    const perfect = event.quality === 'perfect';
    const top = this.tower.topView();
    const index = state.layers.length - 1;
    const impact = this.materialFx.landed(index);
    this.tower.playLanding(impact.wave);
    top?.faceView.react('blink', ANIM.face.blinkMs);
    const { drop, perfectBump, durationMs } = ANIM.cameraKick;
    this.kick.kick(perfect ? -perfectBump : drop * impact.kick, durationMs);

    const pose = this.tower.layerPose(index);
    if (pose) this.landingFx.landed(pose);

    if (perfect) {
      if (pose) this.landingFx.perfect(pose, state.combo);
      top?.playGlossSweep();
      this.tower.reactAll('joy', ANIM.perfect.joyMs);
    } else if (event.cutSide && event.cutWidth > 0 && memo) {
      top?.faceView.react('ouch', ANIM.bite.ouchMs);
      this.debris.biteOff(event, event.cutSide, memo, index);
    }

    const glowing = state.combo >= ANIM.combo.glowFrom;
    if (perfect && glowing) this.glow.flash();
    this.setGlow(glowing);
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
    const piece = this.debris.dropMissed(memo, state);
    if (shielded) return;
    this.missPiece = piece;
    this.slowMoMs = BALANCE.continues.missSlowMoMs;
    this.missWaitMs = BALANCE.continues.missSlowMoMs + ANIM.miss.reactMs;
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
        pieces: this.debris.pieces,
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
    // A layer hidden by a cloud gives nothing away: the faces do not follow it, the top one does not smile at the aim.
    const covered = isCovered(state.flying, state.phase);
    const flying = covered ? null : this.flyingView.position();
    if (flying) this.tower.setLookTarget(flying.x, flying.y);
    else if (this.missPiece) this.tower.setLookTarget(this.missPiece.x, this.missPiece.y);
    else this.tower.setLookTarget();

    const span = this.tower.topSpan();
    const aimed =
      !covered &&
      state.flying !== null &&
      this.tower.topView() !== null &&
      aimMouth(state.flying.x - this.tower.topViewX(), span.right - span.left) === 'open';
    this.tower.setTopMouthHint(aimed ? 'yum' : undefined);
  }

  /** The run is still going: its effects stay on. */
  private runIsOn(state: Readonly<TowerState>): boolean {
    return this.result === null && state.phase !== 'await_continue' && state.phase !== 'over';
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
