import * as Phaser from 'phaser';
import { TimingBot } from '../../core/bot';
import { Rng } from '../../core/rng';
import { TowerSim, type SimPhase } from '../../core/tower-sim';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { readDebugParams } from '../../util/debug-params';
import { frameLerp, randomSeed } from '../../util/math';
import { RunFx, type CameraInfo, type FlyingMemo } from '../fx/run-fx';
import { Background } from '../objects/background';
import { effectsMode } from '../effects-mode';
import { SCENES, type ResultsData } from '../scene-keys';
import { enterWorld, type WorldEntry } from '../ui/transition';
import { isOverUi } from '../ui/ui-regions';

/** World y of the tray surface; the tower grows towards negative y. */
const TRAY_TOP_Y = 0;

/** Read-only snapshot of the run for the HUD and the debug panel. */
export interface RunInfo {
  height: number;
  score: number;
  wobble: number;
  seed: number;
  phase: SimPhase;
  flyingSpeed: number | null;
  paused: boolean;
}

export class GameScene extends Phaser.Scene {
  private sim!: TowerSim;
  private bot: TimingBot | null = null;
  private seed = 0;
  private fx!: RunFx;
  private background!: Background;
  private lastFlying: FlyingMemo | null = null;
  /** Camera scroll before the landing kick is added. */
  private scrollBase = 0;
  /** The world drops in from above when the run starts. */
  private entry: WorldEntry = { offset: 0 };
  private readonly camInfo: CameraInfo = { scrollY: 0, trayScrollY: 0, width: 0, height: 0 };

  constructor() {
    super(SCENES.game);
  }

  create(): void {
    const debug = readDebugParams();
    this.seed = debug.seed ?? randomSeed();
    this.sim = new TowerSim({
      seed: this.seed,
      mode: 'classic',
      team: [null, null, null],
      tutorial: false,
      startHeight: debug.start ?? 0,
    });
    this.bot = debug.bot ? new TimingBot(debug.bot, new Rng(this.seed).fork('bot')) : null;
    this.lastFlying = null;
    this.scrollBase = 0;

    const { width, height } = this.scale.gameSize;
    this.background = new Background(this, TRAY_TOP_Y, width, height);
    this.fx = new RunFx(this, TRAY_TOP_Y);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.keyboard?.on('keydown-SPACE', this.onDropKey, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });

    this.entry = enterWorld(this);
    // Sync once so the tower height is known, then jump the camera to its target.
    this.fx.update(0, 0, this.sim.state, this.cameraInfo());
    this.scrollBase = this.targetScrollY();
    this.applyCamera();
  }

  override update(time: number, delta: number): void {
    effectsMode.noteFrame(delta);
    const flying = this.sim.state.flying;
    this.lastFlying = flying ? { x: flying.x, width: flying.width, index: flying.index } : null;

    const events = this.sim.update(delta);
    this.bot?.observe(events);
    if (this.bot?.shouldDrop(this.sim)) events.push(...this.sim.drop());
    // The continue offer arrives in a later stage: until then the run ends once the miss has played.
    if (this.sim.state.phase === 'await_continue' && this.fx.canDecline) {
      events.push(...this.sim.decline());
    }

    const cam = this.cameraInfo();
    this.fx.handleEvents(events, this.sim.state, this.lastFlying, cam);
    this.fx.update(delta, time, this.sim.state, cam);
    this.followCamera(delta);

    const result = this.fx.takeResult();
    if (result) {
      const data: ResultsData = { result };
      this.scene.launch(SCENES.results, data);
    }
  }

  getRunInfo(): RunInfo | null {
    if (!this.sim) return null;
    const s = this.sim.state;
    return {
      height: s.height,
      score: s.score,
      wobble: s.wobble,
      seed: this.seed,
      phase: s.phase,
      flyingSpeed: s.flying?.speed ?? null,
      paused: this.sys.isPaused(),
    };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (isOverUi(pointer.x, pointer.y)) return;
    this.sim.drop();
  }

  private onDropKey(event: KeyboardEvent): void {
    // Holding the key must not drop every new layer the moment it appears.
    if (event.repeat) return;
    this.sim.drop();
  }

  private onResize(): void {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    this.background.resize(width, height);
    this.fx.resize(width, height);
  }

  /** The camera as the effects need it. One object is reused: it is refreshed on every call. */
  private cameraInfo(): CameraInfo {
    const { width, height } = this.scale.gameSize;
    const info = this.camInfo;
    info.scrollY = this.scrollBase;
    info.trayScrollY = this.trayScrollY();
    info.width = width;
    info.height = height;
    return info;
  }

  /** Follows the target, or the collapse scroll while the tower falls apart. */
  private followCamera(delta: number): void {
    const collapseScroll = this.fx.collapseScroll;
    if (collapseScroll !== null) {
      this.scrollBase = collapseScroll;
    } else {
      const k = frameLerp(ANIM.camera.followLerp, delta);
      this.scrollBase += (this.targetScrollY() - this.scrollBase) * k;
    }
    this.applyCamera();
  }

  /** The kick pushes the view down, which means the camera moves up; the entry lifts the world. */
  private applyCamera(): void {
    const camera = this.cameras.main;
    camera.scrollY = this.scrollBase - this.fx.cameraOffset + this.entry.offset;
    this.background.update(camera.scrollY);
  }

  /** Scroll that shows the tray low on the screen: the start of a run and the end of the collapse. */
  private trayScrollY(): number {
    return TRAY_TOP_Y - (this.scale.gameSize.height - ANIM.camera.trayBottomOffset);
  }

  /**
   * Scroll that keeps the tray low at the start and later shows as many layers as fit
   * while the whole flying layer (with its bob) stays below the HUD.
   */
  private targetScrollY(): number {
    const screenH = this.scale.gameSize.height;
    const flyingReach =
      BALANCE.layer.gapAboveTower + BALANCE.layer.height + ANIM.flying.bobAmplitude;
    const surfaceScreenY = Math.max(
      screenH - ANIM.camera.visibleLayers * BALANCE.layer.height,
      HUD_LAYOUT.bottomEdge + ANIM.camera.hudClearance + flyingReach,
    );
    return Math.min(this.trayScrollY(), this.fx.tower.topY() - surfaceScreenY);
  }
}
