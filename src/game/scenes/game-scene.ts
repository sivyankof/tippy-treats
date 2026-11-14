import * as Phaser from 'phaser';
import { TimingBot } from '../../core/bot';
import type { ActiveEffect, Modifiers } from '../../core/abilities/types';
import { Rng } from '../../core/rng';
import type { TeamSlot } from '../../core/sim-types';
import { TowerSim, type SimEvent, type SimPhase } from '../../core/tower-sim';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { services } from '../../services';
import { readDebugParams } from '../../util/debug-params';
import { frameLerp, randomSeed } from '../../util/math';
import { RunFx, type CameraInfo, type FlyingMemo } from '../fx/run-fx';
import { Backdrop } from '../objects/backdrop/backdrop';
import { getDebugTeam, toTeamSlots } from '../debug/debug-team';
import { ContinueFlow } from '../continue-flow';
import { effectsMode } from '../effects-mode';
import { cuesForMoment } from '../fx/moment-cues';
import { playCues } from '../fx/run-cues';
import { sessionWallet } from '../session-wallet';
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
  /** The team of the run; the same array for the whole run. */
  team: readonly (TeamSlot | null)[];
  /** Live list of the active effects: read it at once, do not keep it. */
  effects: readonly ActiveEffect[];
  /** Layers left on the brownie shield, 0 for none. */
  shield: number;
  /** Index of the zone of the run (the banner announces a change). */
  zoneIndex: number;
  coins: number;
  berries: number;
}

export class GameScene extends Phaser.Scene {
  private sim!: TowerSim;
  private bot: TimingBot | null = null;
  private seed = 0;
  private team: Array<TeamSlot | null> = [];
  private fx!: RunFx;
  /** The "Continue?" offer after a miss; the HUD draws its window. */
  continueFlow: ContinueFlow | null = null;
  private background!: Backdrop;
  /** The flying layer before the latest step, or `null`; `flyingMemo` is the one object behind it. */
  private lastFlying: FlyingMemo | null = null;
  private readonly flyingMemo: FlyingMemo = {
    x: 0,
    width: 0,
    kind: 'plain',
    creature: undefined,
    level: undefined,
  };
  /** Handed out by `getRunInfo` every frame: one object, refilled each time. */
  private readonly runInfo: RunInfo = {
    height: 0,
    score: 0,
    wobble: 0,
    seed: 0,
    phase: 'flying',
    flyingSpeed: null,
    paused: false,
    team: [],
    effects: [],
    shield: 0,
    zoneIndex: 0,
    coins: 0,
    berries: 0,
  };
  /** Drop modifiers as the sim last reported them; refreshed whenever a step had events. */
  private mods!: Readonly<Modifiers>;
  /** Camera scroll before the landing kick is added. */
  private scrollBase = 0;
  /** The world drops in from above when the run starts. */
  private entry: WorldEntry = { offset: 0 };
  private readonly camInfo: CameraInfo = { scrollY: 0, trayScrollY: 0, width: 0, height: 0 };

  constructor() {
    super(SCENES.game);
  }

  create(): void {
    this.tweens.timeScale = 1;
    const debug = readDebugParams();
    this.seed = debug.seed ?? randomSeed();
    // Until the Team screen (M6) the debug team is the team of every run.
    this.team = toTeamSlots(getDebugTeam());
    this.sim = new TowerSim({
      seed: this.seed,
      mode: 'classic',
      team: this.team,
      tutorial: false,
      startHeight: debug.start ?? 0,
    });
    this.mods = this.sim.currentModifiers();
    this.bot = debug.bot ? new TimingBot(debug.bot, new Rng(this.seed).fork('bot')) : null;
    this.lastFlying = null;
    this.scrollBase = 0;
    this.continueFlow?.dispose();
    this.continueFlow = new ContinueFlow({
      ads: services.ads,
      audio: services.audio,
      wallet: sessionWallet,
    });

    const { width, height } = this.scale.gameSize;
    this.background = new Backdrop(this, TRAY_TOP_Y, width, height, this.sim.state.zoneIndex);
    this.fx = new RunFx(this, TRAY_TOP_Y);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.keyboard?.on('keydown-SPACE', this.onDropKey, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.continueFlow?.dispose();
    });

    this.entry = enterWorld(this);
    // Sync once so the tower height is known, then jump the camera to its target.
    this.fx.update(0, 0, this.sim.state, this.mods, this.cameraInfo());
    this.scrollBase = this.targetScrollY();
    this.applyCamera();
  }

  override update(time: number, delta: number): void {
    effectsMode.noteFrame(delta);
    const flying = this.sim.state.flying;
    if (flying) {
      const memo = this.flyingMemo;
      memo.x = flying.x;
      memo.width = flying.width;
      memo.kind = flying.kind;
      memo.creature = flying.creature;
      memo.level = flying.level;
      this.lastFlying = memo;
    } else {
      this.lastFlying = null;
    }

    const events = this.sim.update(delta);
    this.bot?.observe(events);
    if (this.bot?.shouldDrop(this.sim)) events.push(...this.sim.drop());
    this.driveContinue(delta, events);

    const cam = this.cameraInfo();
    this.fx.handleEvents(events, this.sim.state, this.lastFlying, this.mods, cam);
    if (events.length > 0) this.mods = this.sim.currentModifiers();
    this.fx.update(delta, time, this.sim.state, this.mods, cam);
    this.background.setZone(this.sim.state.zoneIndex);
    // Slow motion slows the tweens and the camera too; the HUD scene keeps its own clock.
    this.tweens.timeScale = this.fx.timeScale;
    this.followCamera(delta * this.fx.timeScale);

    const result = this.fx.takeResult();
    if (result) {
      sessionWallet.add(result.berries);
      const data: ResultsData = { result };
      this.scene.launch(SCENES.results, data);
    }
  }

  /**
   * After the miss has played: opens the "Continue?" offer, or ends the run when no window must
   * show (and always under a bot, which has nobody to press the buttons). Then runs the offer.
   */
  private driveContinue(delta: number, events: SimEvent[]): void {
    const flow = this.continueFlow;
    if (!flow || this.sim.state.phase !== 'await_continue') return;
    if (!flow.isOpen) {
      if (!this.fx.canDecline) return;
      const opened = !this.bot && flow.open('classic', this.sim.state.continuesUsed);
      if (!opened) events.push(...this.sim.decline());
      return;
    }
    flow.update(delta);
    const action = flow.takeAction();
    if (action === 'continue') {
      events.push(...this.sim.continueRun());
      playCues(cuesForMoment('continued'), services);
    } else if (action === 'decline') {
      events.push(...this.sim.decline());
    }
  }

  /** The state of the run for the HUD. The object is reused: read it at once, do not keep it. */
  getRunInfo(): Readonly<RunInfo> | null {
    if (!this.sim) return null;
    const s = this.sim.state;
    const info = this.runInfo;
    info.height = s.height;
    info.score = s.score;
    info.wobble = s.wobble;
    info.seed = this.seed;
    info.phase = s.phase;
    info.flyingSpeed = s.flying?.speed ?? null;
    info.paused = this.sys.isPaused();
    info.team = this.team;
    info.effects = s.effects;
    info.shield = s.shield;
    info.zoneIndex = s.zoneIndex;
    info.coins = s.coins;
    info.berries = s.berries;
    return info;
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
