import { TOWER_SPARKLES } from '../../data/tower-sparkles';
import * as Phaser from 'phaser';
import { fxGuard } from '../fx-guard';
import type { Modifiers } from '../../core/abilities/types';
import type { FlyingLayer, SimEvent, TowerState } from '../../core/tower-sim';
import type { RunResult } from '../../core/run-result';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { CONTINUE_ANIM } from '../../data/continue-anim';
import { services } from '../../services';
import { Rng } from '../../core/rng';
import { gameState } from '../../state';
import { effectsMode } from '../effects-mode';
import { aimMouth } from '../objects/face-state';
import { FlyingLayerView } from '../objects/flying-layer-view';
import type { LayerView } from '../objects/layer-view';
import { startRainbowJokeNow } from '../objects/rainbow-idle';
import type { LickKind, LickScene } from '../objects/lick-plan';
import type { GuestSource } from '../objects/backdrop/guest-source';
import { TowerGuest, type GuestContext } from '../objects/tower-guest';
import { MasterFeed } from '../ui/master-caption-state';
import type { CreatureId } from '../../data/creatures';
import type { WeatherId } from '../../data/weather';
import { TowerView } from '../objects/tower-view';
import { AbilityFx } from './abilities/ability-fx';
import { CameraKick } from './camera-kick';
import { CoinFx } from './coin-fx';
import { ComboGlow } from './combo-glow';
import { DebrisFx } from './debris-fx';
import { FlyingFx } from './flying-fx';
import { LapEdges } from './lap-edges';
import { LandingFx } from './landing-fx';
import { MaterialFx } from './material-fx';
import { RecordMoment } from './record-moment';
import { heartPop } from './sparkle-fx';
import { cuesForEvents, playCues } from './run-cues';
import { isCovered } from './rule-state';
import { TowerSparkles } from './tower-sparkles';
import type { SparkleField } from './tower-sparkle-spot';
import { TowerCollapse } from './tower-collapse';
import { TopperFx } from './topper-fx';
import { clearRunHooks, runHooks, setRunHooks, type RunHooks } from '../perf/run-hooks';

/** The flying layer as it was before the sim step that just ran. */
export type FlyingMemo = Pick<FlyingLayer, 'x' | 'width' | 'kind' | 'creature' | 'level'>;
type LandEvent = Extract<SimEvent, { type: 'land' }>;

const isLand = (e: SimEvent): e is LandEvent => e.type === 'land';
const isSneeze = (e: SimEvent): boolean => e.type === 'wobble_sneeze';

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
/** How many of the topmost layers a sparkle can stand beside (the rows it may reach below the top). */
const SPARKLE_LAYERS = Math.ceil(TOWER_SPARKLES.rowsBelow);

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
  private readonly lapEdges: LapEdges;
  private readonly recordMoment: RecordMoment;
  private readonly guest: TowerGuest;
  private readonly sparkles: TowerSparkles;
  /** Refilled for the sparkles every frame. */
  private readonly sparkleField: SparkleField = {
    left: 0,
    right: 0,
    topY: 0,
    layerHeight: BALANCE.layer.height,
    screenWidth: 0,
    avoid: null,
  };
  private readonly flyColumn = { left: 0, right: 0 };
  private guestCtx: GuestContext | null = null;
  private readonly topperFx: TopperFx;
  /** The master effects that acted, for the captions of the HUD. */
  readonly masterFeed = new MasterFeed();
  /** The latest frame's inputs, for the debug hook. */
  private lastFrame: {
    state: Readonly<TowerState>;
    mods: Readonly<Modifiers>;
    cam: CameraInfo;
  } | null = null;

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

  /** `seed` is the run seed: the sparkles take their random draws from its cosmetic stream. */
  constructor(scene: Phaser.Scene, trayTopY: number, seed: number, weather: WeatherId) {
    this.sparkles = new TowerSparkles(scene, new Rng(seed).fork('sparkles'));
    this.tower = new TowerView(scene, trayTopY);
    this.flyingView = new FlyingLayerView(scene, this.tower);
    this.glow = new ComboGlow(scene);
    this.landingFx = new LandingFx(scene);
    this.debris = new DebrisFx(scene, this.tower, this.landingFx);
    this.abilityFx = new AbilityFx(scene, this.tower, this.flyingView, this.landingFx);
    this.materialFx = new MaterialFx(this.tower, this.landingFx.particles);
    this.coinFx = new CoinFx(scene, this.tower, this.landingFx.particles);
    this.flyingFx = new FlyingFx(
      scene,
      this.tower,
      this.flyingView,
      this.landingFx.particles,
      weather,
    );
    this.lapEdges = new LapEdges(scene, this.tower);
    this.recordMoment = new RecordMoment(
      scene,
      this.tower,
      this.landingFx,
      this.glow,
      gameState.recordHeight,
    );
    this.guest = new TowerGuest(scene, this.tower, this.landingFx, {
      splat: () => services.audio.guestSplat(),
      peel: () => services.audio.guestPeel(),
      buzz: () => services.audio.guestBuzz(),
      giggle: () => services.audio.guestGiggle(),
      kick: (mul) => this.kick.kick(ANIM.cameraKick.drop * mul, ANIM.cameraKick.durationMs),
    });
    this.topperFx = new TopperFx(scene, () => services.audio.topperHop());
    const licks = this.tower.licks;
    this.abilityFx.onRainbowPuff = () => services.audio.cloudPuff();
    let jokesPlayed = 0;
    this.tower.onRainbowJoke = () => {
      jokesPlayed += 1;
      services.audio.rainbowJoke();
    };
    licks.onSlurp = () => services.audio.lickSlurp();
    licks.onSlurpLong = () => services.audio.lickSlurpLong();
    licks.onSmack = () => services.audio.lickSmack();
    licks.onHappy = (x, y) => {
      services.audio.lickHum();
      heartPop(this.landingFx.particles, x, y);
    };
    // The benchmark's way in, in every build; it holds the run, so the scene lets go of it on shutdown.
    const hooks: RunHooks = {
      lick: (scene, kind) => this.tower.lickNow(scene, kind),
      lickStage: () => licks.stage,
      guest: () => this.guest.landNow(),
      rainbowJoke: startRainbowJokeNow,
      jokesPlayed: () => jokesPlayed,
      arcGrown: () => this.abilityFx.rainbowArcGrown,
    };
    setRunHooks(hooks);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearRunHooks(hooks));
    if (import.meta.env.DEV) {
      // The same hooks for the console of the dev server.
      const win = window as Window & {
        tippyLick?: (scene?: LickScene, kind?: LickKind) => boolean;
        tippyRainbowJoke?: () => void;
        tippyFly?: () => boolean;
        tippyMaster?: (creature: CreatureId, coins?: number, score?: number) => boolean;
      };
      // window.tippyLick('big' | 'short', 'run' | 'fall'): a layer licks right away; true when one could.
      win.tippyLick = (scene, kind) => runHooks()?.lick(scene, kind) ?? false;
      // window.tippyRainbowJoke(): the next Rainbow star pops its small rainbow right away.
      win.tippyRainbowJoke = () => runHooks()?.rainbowJoke();
      // window.tippyFly(): the guest of the zone sits on the top layer right away; true when it could.
      win.tippyFly = () => runHooks()?.guest() ?? false;
      // window.tippyMaster('lemon', 10): the master effect of that creature acts right away; true when it could.
      win.tippyMaster = (creature, coins = 0, score = 0) =>
        this.debugMaster(creature, coins, score);
    }
  }

  /** Debug: plays a `mastery` event of `creature` as if the sim had sent it. */
  private debugMaster(creature: CreatureId, coins: number, score: number): boolean {
    const frame = this.lastFrame;
    if (!frame) return false;
    this.handleEvents(
      [{ type: 'mastery', creature, coins, score }],
      frame.state,
      null,
      frame.mods,
      frame.cam,
    );
    return true;
  }

  /** The backdrop creature the tower's guest flies out of (it is hidden there while the guest is out). */
  setGuestSource(get: () => GuestSource | null): void {
    this.guest.setSource(get);
  }

  /** The miss has played out: the run may be declined. */
  get canDecline(): boolean {
    return this.missWaitMs !== null && this.missWaitMs <= 0;
  }

  /** The drawn shadow of the flying layer (world space), for the hints that point at it. */
  shadowAnchor(): Readonly<{ x: number; y: number; visible: boolean }> {
    return this.flyingView.shadowAnchor();
  }

  /** Share of real time that the visuals run at: below 1 during the slow-motion miss. */
  get timeScale(): number {
    return this.slowMoMs > 0 ? CONTINUE_ANIM.slowMoScale : 1;
  }

  /** While the camera rises along the pre-built tower only the layers on screen are drawn. */
  setIntroView(on: boolean): void {
    this.tower.setWindowed(on);
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
    // Every effect below runs through the safety net; only the result and the miss wait are flow.
    fxGuard.call('master-feed', this.masterFeed, this.masterFeed.take, events);
    fxGuard.call('cues', this, this.playEventCues, events, state, memo);
    const land = events.find(isLand);
    const tower = this.tower;
    if (land) {
      fxGuard.call('tower-land-cut', tower, tower.noteCut, state.layers.length - 1, land.cutSide);
    }
    // The sway of the frame before the sneeze is the one the tower holds.
    if (events.some(isSneeze)) {
      fxGuard.call('sneeze-freeze', tower, tower.freeze, ANIM.sneeze.freezeMs);
    }
    fxGuard.call('ability-before-sync', this.abilityFx, this.abilityFx.beforeSync, events);
    if (land) {
      const topper = this.topperFx;
      // The topper under the landing layer hops off while its view still shows it.
      fxGuard.call('topper-hop', topper, topper.hopOffBelow, tower, state);
      // Landings need the view of the new layer, which normally appears on the next sync. This is
      // the view's own sync, not a decoration: it has a guard of its own, like the per-frame one.
      const bottom = cam.scrollY + cam.height;
      fxGuard.call('tower-land-sync', tower, tower.sync, state, bottom, cam.scrollY);
      fxGuard.call('topper-settle', topper, topper.settleOnTop, tower, state, memo);
    }

    for (const event of events) {
      switch (event.type) {
        case 'spawn':
          this.missWaitMs = null;
          this.slowMoMs = 0;
          break;
        case 'land':
          fxGuard.call('land-fx', this, this.onLand, event, state, memo, cam);
          break;
        case 'combo':
          fxGuard.call('combo-fx', this, this.onCombo, event.widened, state);
          break;
        case 'wobble_sneeze':
          fxGuard.call('sneeze-fx', this, this.onSneeze, state);
          break;
        case 'tempo_ease':
          fxGuard.call('exhale-fx', tower, tower.exhale);
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
    const ability = this.abilityFx;
    fxGuard.call('ability-events', ability, ability.handleEvents, events, state, memo, mods, cam);
    fxGuard.call('coin-events', this.coinFx, this.coinFx.handleEvents, events, state, cam);
    fxGuard.call('flying-events', this.flyingFx, this.flyingFx.handleEvents, events);
    fxGuard.call('guest-events', this.guest, this.guest.handleEvents, events, state);
  }

  /** Per frame: places everything and advances the effects. */
  update(
    dtMs: number,
    timeMs: number,
    state: Readonly<TowerState>,
    mods: Readonly<Modifiers>,
    cam: CameraInfo,
  ): void {
    if (import.meta.env.DEV) {
      const frame = (this.lastFrame ??= { state, mods, cam });
      frame.state = state;
      frame.mods = mods;
      frame.cam = cam;
    }
    // Waits and the collapse run on real time, everything that moves on visual time.
    const realMs = dtMs;
    const visualMs = realMs * this.timeScale;
    this.slowMoMs = Math.max(0, this.slowMoMs - realMs);
    this.advanceEnd(realMs, state, cam);

    // The views and effects below run through the safety net: a broken one is skipped.
    // `call` takes the method and its arguments, so a frame makes no closures.
    const tower = this.tower;
    const bottom = cam.scrollY + cam.height;
    fxGuard.call('tower-sync', tower, tower.sync, state, bottom, cam.scrollY);
    fxGuard.call('flying-view', this.flyingView, this.flyingView.sync, state, timeMs, visualMs);
    const flyingFx = this.flyingFx;
    const ghost = mods.guidesMaster;
    fxGuard.call('flying-fx', flyingFx, flyingFx.update, visualMs, timeMs, state, ghost);
    fxGuard.call('lap-edges', this.lapEdges, this.lapEdges.update, visualMs, timeMs, state);
    fxGuard.call('coin-fx', this.coinFx, this.coinFx.update, visualMs, timeMs, state);
    fxGuard.call('faces', this, this.pointFaces, state);
    fxGuard.call('tower-tick', this, this.tickTower, visualMs, cam);
    fxGuard.call('guest', this, this.updateGuest, visualMs, state, cam);
    fxGuard.call('debris', this.debris, this.debris.update, visualMs);
    fxGuard.call('topper-fx', this.topperFx, this.topperFx.update, visualMs);
    fxGuard.call('landing-fx', this.landingFx, this.landingFx.update, visualMs);
    fxGuard.call('material-fx', this.materialFx, this.materialFx.update, visualMs, state.wobble);
    fxGuard.call('ability-fx', this, this.updateAbilityFx, visualMs, timeMs, state, mods, cam);
    fxGuard.call('kick', this.kick, this.kick.update, visualMs);
    const record = this.recordMoment;
    fxGuard.call('record-moment', record, record.update, visualMs, timeMs, state, cam);
    fxGuard.call('glow', this, this.placeGlow, timeMs, cam);
    fxGuard.call('sparkles', this, this.updateSparkles, visualMs, state, cam);
  }

  private playEventCues(
    events: readonly SimEvent[],
    state: Readonly<TowerState>,
    memo: FlyingMemo | null,
  ): void {
    playCues(cuesForEvents(events, state, memo), services);
  }

  private onSneeze(state: Readonly<TowerState>): void {
    this.tower.squashTop();
    this.debris.sneeze(state);
  }

  private tickTower(visualMs: number, cam: CameraInfo): void {
    this.tower.setScreenBand(cam.scrollY, cam.scrollY + cam.height);
    this.tower.tick(visualMs);
  }

  /** The guest's view of the frame; the object is made once and refilled. */
  private updateGuest(visualMs: number, state: Readonly<TowerState>, cam: CameraInfo): void {
    const shadow = this.flyingView.shadowAnchor();
    const ctx = (this.guestCtx ??= { state, cam, shadow });
    ctx.state = state;
    ctx.cam = cam;
    ctx.shadow = shadow;
    this.guest.update(visualMs, ctx);
  }

  private updateAbilityFx(
    visualMs: number,
    timeMs: number,
    state: Readonly<TowerState>,
    mods: Readonly<Modifiers>,
    cam: CameraInfo,
  ): void {
    this.abilityFx.update(visualMs, timeMs, state, mods, cam, this.runIsOn(state));
  }

  private updateSparkles(visualMs: number, state: Readonly<TowerState>, cam: CameraInfo): void {
    const on = this.runIsOn(state) && !effectsMode.reduced;
    this.sparkles.update(visualMs, this.sparkleFieldFor(state, cam), on);
  }

  /** The tower as the sparkles need it; the object is reused. */
  private sparkleFieldFor(state: Readonly<TowerState>, cam: CameraInfo): SparkleField {
    const field = this.sparkleField;
    this.tower.widestSpan(SPARKLE_LAYERS, field);
    field.topY = this.tower.topY();
    field.screenWidth = cam.width;
    const { flying } = state;
    if (flying) {
      this.flyColumn.left = flying.x - flying.width / 2;
      this.flyColumn.right = flying.x + flying.width / 2;
    }
    field.avoid = flying ? this.flyColumn : null;
    return field;
  }

  private onLand(
    event: LandEvent,
    state: Readonly<TowerState>,
    memo: FlyingMemo | null,
    cam: CameraInfo,
  ): void {
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
      if (!effectsMode.reduced) this.sparkles.perfect(this.sparkleFieldFor(state, cam));
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
    const piece = fxGuard.value('miss-debris', () => this.debris.dropMissed(memo, state), null);
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
