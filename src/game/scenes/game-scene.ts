import * as Phaser from 'phaser';
import { TimingBot } from '../../core/bot';
import type { Modifiers } from '../../core/abilities/types';
import { Rng } from '../../core/rng';
import { emptyTally, tallyEvents, type RunTally } from '../../core/run-tally';
import type { TeamSlot } from '../../core/sim-types';
import { TowerSim, type SimEvent } from '../../core/tower-sim';
import { BALANCE } from '../../data/balance';
import { services } from '../../services';
import { RunFx, type FlyingMemo } from '../fx/run-fx';
import { Backdrop } from '../objects/backdrop/backdrop';
import { RunCamera } from '../run-camera';
import { ContinueFlow } from '../continue-flow';
import { RunRecorder } from '../run-recorder';
import { effectsMode } from '../effects-mode';
import { cuesForMoment } from '../fx/moment-cues';
import { playCues } from '../fx/run-cues';
import { berriesFromEvents } from '../../core/berries';
import { gameState } from '../../state';
import { EMPTY_SUMMARY } from '../../state/game-state';
import { emptyRunInfo, fillRunInfo, type RunInfo } from '../run-info';
import { bindPageLeave } from '../../state/page-lifecycle';
import { launchRun, openScreen, SCENES, type ResultsData } from '../scene-keys';
import { exitTarget } from '../run-exit';
import { CLASSIC_RUN, demoFinished, type RunRequest } from '../run-request';
import { setupRun } from '../run-setup';
import { DEMO } from '../../data/demo';
import { enterWorld, leaveScreen } from '../ui/transition';
import { isOverUi } from '../ui/ui-regions';
import { TutorialDirector } from '../tutorial/tutorial-director';

/** World y of the tray surface; the tower grows towards negative y. */
const TRAY_TOP_Y = 0;

export class GameScene extends Phaser.Scene {
  private sim!: TowerSim;
  private bot: TimingBot | null = null;
  private seed = 0;
  private startHeight = 0;
  /** What kind of run this is: a normal one or a creature demo. */
  request: RunRequest = CLASSIC_RUN;
  /** False for `?bot=`, `?start=` and demo runs: nothing of them reaches the save. */
  private writesSave = true;
  /** The run ends without the "Continue?" window (bot, demo). */
  private noContinue = false;
  /** Coins by source and abilities, for the results screen. */
  private tally: RunTally = emptyTally();
  /** The demo has placed its layers and leaves after a short pause. */
  private demoLeaving = false;
  /** The run is being left for another screen: only once. */
  private exiting = false;
  /** Puts the run into the save once: when it ends or when the player leaves it. */
  private recorder = new RunRecorder(gameState, 0);
  private team: Array<TeamSlot | null> = [];
  private fx!: RunFx;
  /** The one-time hints of the run; the HUD draws them. */
  tutorial: TutorialDirector | null = null;
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
  private readonly runInfo: RunInfo = emptyRunInfo();
  /** Drop modifiers as the sim last reported them; refreshed whenever a step had events. */
  private mods!: Readonly<Modifiers>;
  private camera!: RunCamera;

  constructor() {
    super(SCENES.game);
  }

  /** `data` is the run request; Phaser hands an empty object when there is none. */
  create(data?: Partial<RunRequest>): void {
    this.tweens.timeScale = 1;
    this.request = data && 'kind' in data ? (data as RunRequest) : CLASSIC_RUN;
    const setup = setupRun(this.request);
    this.seed = setup.seed;
    this.startHeight = setup.startHeight;
    this.writesSave = setup.writesSave;
    this.noContinue = setup.noContinue;
    this.tally = emptyTally();
    this.demoLeaving = false;
    this.exiting = false;
    this.recorder = new RunRecorder(gameState, this.startHeight, this.writesSave);
    this.tutorial = setup.hints ? new TutorialDirector(gameState, setup.tutorialRun) : null;
    this.team = setup.team;
    this.sim = new TowerSim({
      seed: this.seed,
      mode: 'classic',
      team: this.team,
      tutorial: setup.tutorialRun,
      startHeight: this.startHeight,
    });
    this.mods = this.sim.currentModifiers();
    this.bot = setup.bot ? new TimingBot(setup.bot, new Rng(this.seed).fork('bot')) : null;
    this.lastFlying = null;
    this.continueFlow?.dispose();
    this.continueFlow = new ContinueFlow({
      ads: services.ads,
      audio: services.audio,
      wallet: gameState,
    });

    const { width, height } = this.scale.gameSize;
    this.background = new Backdrop(this, TRAY_TOP_Y, width, height, this.sim.state.zoneIndex);
    this.fx = new RunFx(this, TRAY_TOP_Y);
    this.camera = new RunCamera(this, this.fx, this.background, TRAY_TOP_Y);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.keyboard?.on('keydown-SPACE', this.onDropKey, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    // Closing or reloading the page mid-run is a quit: the coins of the run stay with the player.
    const unbindLeave = bindPageLeave(
      () => {
        this.recorder.recordQuit(this.sim);
        gameState.flush();
      },
      // Back from the page cache: that run is already recorded, so start a new one.
      () => launchRun(this, this.request),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unbindLeave();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.continueFlow?.dispose();
      this.recorder.recordQuit(this.sim);
    });

    this.camera.setEntry(enterWorld(this));
    // Sync once so the tower height is known, then jump the camera to its target.
    this.fx.update(0, 0, this.sim.state, this.mods, this.camera.cameraInfo());
    this.camera.snap();
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

    // The tutorial holds the sim for a moment while it explains the creature layer.
    this.tutorial?.tick(delta);
    const held = this.tutorial?.holding ?? false;
    const events = held ? [] : this.sim.update(delta);
    this.bot?.observe(events);
    if (!held && this.bot?.shouldDrop(this.sim)) events.push(...this.sim.drop());
    this.tutorial?.observe(events, this.sim.state);
    this.driveContinue(delta, events);
    // Berries go to the save the moment they are earned: they can pay for this run's continue.
    if (this.writesSave) gameState.addBerries(berriesFromEvents(events));
    this.recordFinishedRun(events);
    tallyEvents(this.tally, events);
    this.watchDemo();

    const cam = this.camera.cameraInfo();
    this.fx.handleEvents(events, this.sim.state, this.lastFlying, this.mods, cam);
    if (events.length > 0) this.mods = this.sim.currentModifiers();
    this.fx.update(delta, time, this.sim.state, this.mods, cam);
    this.background.setZone(this.sim.state.zoneIndex);
    // Slow motion slows the tweens and the camera too; the HUD scene keeps its own clock.
    this.tweens.timeScale = this.fx.timeScale;
    this.camera.follow(delta * this.fx.timeScale);
    this.placeTutorialTarget();

    const result = this.fx.takeResult();
    if (!result) return;
    if (this.request.kind === 'demo') {
      this.leaveRun();
      return;
    }
    // A run that did not reach the save (dev bot, start height) keeps the bar where it is.
    const { bakerLevel: level, bakerXp: xp } = gameState.data;
    const summary = this.recorder.summary ?? { ...EMPTY_SUMMARY, before: { level, xp } };
    const data: ResultsData = { result, summary, tally: this.tally, recorded: this.writesSave };
    this.scene.launch(SCENES.results, data);
  }

  /**
   * Leaves the run for the screen it came from (`exitTarget`): a normal run is recorded first, so
   * the creatures its level-ups handed out can be presented. The screen darkens first, unless the
   * caller has already darkened it (the pause window).
   */
  leaveRun(alreadyDark = false): void {
    if (this.exiting) return;
    this.exiting = true;
    this.recorder.recordQuit(this.sim);
    const target = exitTarget(this.request, this.recorder.summary);
    const go = (): void => openScreen(this, target.key, target.data);
    if (alreadyDark) go();
    else leaveScreen(this.scene.get(SCENES.hud), [], go);
  }

  /** A demo that has placed its layers stops taking taps and goes back to the card. */
  private watchDemo(): void {
    if (this.request.kind !== 'demo' || this.demoLeaving) return;
    if (!demoFinished(this.sim.state.layers.length)) return;
    this.demoLeaving = true;
    this.time.delayedCall(DEMO.endDelayMs, () => this.leaveRun());
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
      const opened = !this.noContinue && flow.open('classic', this.sim.state.continuesUsed);
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

  /** The run is over: its coins, XP and record go into the save, once. */
  private recordFinishedRun(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'run_over') {
        this.recorder.recordOver(event.result);
        return;
      }
    }
  }

  /** The state of the run for the HUD. The object is reused: read it at once, do not keep it. */
  getRunInfo(): Readonly<RunInfo> | null {
    if (!this.sim) return null;
    return fillRunInfo(this.runInfo, this.sim.state, this.seed, this.team, this.sys.isPaused());
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (isOverUi(pointer.x, pointer.y) || this.tutorial?.holding || this.demoLeaving) return;
    this.sim.drop();
  }

  private onDropKey(event: KeyboardEvent): void {
    // Holding the key must not drop every new layer the moment it appears.
    if (event.repeat || this.tutorial?.holding || this.demoLeaving) return;
    this.sim.drop();
  }

  /** Tells the director where the tower top and the creature layer are on the screen, so hints can be placed. */
  private placeTutorialTarget(): void {
    const tutorial = this.tutorial;
    if (!tutorial) return;
    // Where the top of the tower settles on the screen: hints keep out of the flying row above it.
    tutorial.towerTopY = this.fx.tower.topY() - this.camera.targetScrollY();
    if (!tutorial.holding) return;
    const pose = this.fx.tower.layerPose(tutorial.introLayerIndex);
    if (!pose) return;
    const camera = this.cameras.main;
    tutorial.setTarget(pose.x - camera.scrollX, pose.y - BALANCE.layer.height / 2 - camera.scrollY);
  }

  private onResize(): void {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    this.background.resize(width, height);
    this.fx.resize(width, height);
  }
}
