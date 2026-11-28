import * as Phaser from 'phaser';
import type { Modifiers } from '../../core/abilities/types';
import { emptyTally, tallyEvents, type RunTally } from '../../core/run/run-tally';
import type { CheckpointHeight } from '../../core/zones/checkpoints';
import type { RunMode, RunResult } from '../../core/run/run-result';
import type { TeamSlot } from '../../core/tower/sim-types';
import { TowerSim, type TowerState } from '../../core/tower/tower-sim';
import { fxGuard } from '../common/fx-guard';
import { RunFx } from '../fx/run/run-fx';
import type { MasterFeed } from '../ui/creatures/master-caption-state';
import { easeFn } from '../fx/common/ease';
import { RunIntro } from '../fx/run/run-intro';
import { effectsMode } from '../app/effects-mode';
import { Backdrop } from '../objects/backdrop/common/backdrop';
import { watchRunSky } from '../app/status-bar';
import { RunWeather } from '../objects/backdrop/weather/run-weather';
import { plainLooks } from '../objects/tower/plain-look';
import { installSquashDebug } from '../debug/squash-debug';
import { prepareStartTower } from '../perf/perf-demo-marks';
import { perfSession } from '../perf/perf-session';
import { layerMarks } from '../objects/tower/layer-marks';
import { trimHudPlates } from '../ui/style/hud-plate';
import { RunCamera } from '../run/run-camera';
import { ContinueFlow } from '../run/continue-flow';
import { beginRunRewardedMemo, rewardedAds } from '../economy/rewarded';
import { bindRunDraft, extrasOf, RunRecorder } from '../run/run-recorder';
import { FlyingTracker } from '../fx/tower/flying-follow';
import { placeTutorialTarget } from '../fx/run/tutorial-target';
import { driveContinue } from '../objects/run/continue-driver';
import { berriesFromEvents } from '../../core/economy/berries';
import { gameState } from '../../state';
import { services } from '../../services';
import { emptyRunInfo, fillRunInfo, type RunInfo } from '../run/run-info';
import { bindPageLeave } from '../../state/page-lifecycle';
import { logRunStart } from '../run/run-telemetry';
import {
  dropHeldResults,
  RESULTS_SETTLED,
  ResultsHandoff,
  revealResults,
} from '../run/results-launch';
import { openScreen, restartRun, SCENES } from '../app/scene-keys';
import { exitTarget } from '../run/run-exit';
import { CLASSIC_RUN, demoFinished, type RunRequest } from '../run/run-request';
import { setupRun } from '../run/run-setup';
import { DropDriverSlot } from '../run/drop-driver-slot';
import { installCutDebug } from '../debug/cut-debug';
import { ANIM } from '../../data/common/anim';
import { DEMO } from '../../data/run/demo';
import { enterWorld, leaveScreen } from '../ui/common/transition';
import { isOverUi } from '../ui/common/ui-regions';
import { TutorialDirector } from '../tutorial/tutorial-director';

/** World y of the tray surface; the tower grows towards negative y. */
const TRAY_TOP_Y = 0;

export class GameScene extends Phaser.Scene {
  private sim!: TowerSim;
  readonly drivers = new DropDriverSlot();
  /** A `?perf=1` benchmark run: its results show as saved (the save itself is never touched). */
  private perfRun = false;
  private seed = 0;
  private startHeight = 0;
  /** The checkpoint the run started from (null: the zero start), for the results. */
  private checkpoint: CheckpointHeight | null = null;
  /** What kind of run this is: a normal one or a creature demo. */
  request: RunRequest = CLASSIC_RUN;
  /** False for `?bot=`, `?start=` and demo runs: nothing of them reaches the save. */
  private writesSave = true;
  /** The run ends without the "Continue?" window (bot, demo). */
  private noContinue = false;
  /** The mode of the run: a classic tower or the daily tower. */
  private mode: RunMode = 'classic';
  /** Coins by source and abilities, for the results screen. */
  private tally: RunTally = emptyTally();
  /** The demo has placed its layers and leaves after a short pause. */
  private demoLeaving = false;
  /** The results scene of this run (it builds while the tower falls). */
  private readonly results = new ResultsHandoff();
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
  private weather: RunWeather | null = null;
  /** The flying layer before each step, for the sound and effect cues. */
  private readonly flying = new FlyingTracker();
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
    // The continue offer at the end of the run needs an ad: one that gave up loading tries again now.
    services.ads.wake();
    fxGuard.reset();
    this.request = data && 'kind' in data ? (data as RunRequest) : CLASSIC_RUN;
    const setup = setupRun(this.request);
    this.seed = setup.seed;
    // The plain layers take their look from the cosmetic stream of the seed.
    plainLooks.setRunSeed(this.seed);
    // Drops, stains and cream rolls of the last run stay with it.
    layerMarks.clear();
    // The pictures of the plates of the last run's HUD are trimmed before this run's are placed.
    trimHudPlates(this);
    this.startHeight = setup.startHeight;
    this.checkpoint = setup.checkpoint;
    this.writesSave = setup.writesSave;
    this.noContinue = setup.noContinue;
    this.mode = setup.mode;
    this.tally = emptyTally();
    beginRunRewardedMemo(setup.paidByAd);
    this.demoLeaving = false;
    this.exiting = false;
    this.recorder = new RunRecorder(gameState, this.startHeight, this.writesSave, () =>
      extrasOf(this.tally),
    );
    this.tutorial = setup.hints ? new TutorialDirector(gameState, setup.tutorialRun) : null;
    this.team = setup.team;
    this.sim = new TowerSim({
      seed: this.seed,
      mode: setup.mode,
      team: this.team,
      tutorial: setup.tutorialRun,
      startHeight: this.startHeight,
      startWidth: setup.startWidth,
    });
    this.mods = this.sim.currentModifiers();
    if (perfSession()) prepareStartTower(this.sim.state.layers);
    logRunStart(setup, gameState.data.stats.runs);
    this.perfRun = setup.perfDriver !== undefined;
    this.drivers.reset(setup.perfDriver, setup.bot, this.seed);
    this.flying.reset();
    if (import.meta.env.DEV) installCutDebug(this);
    this.continueFlow?.dispose();
    this.continueFlow = new ContinueFlow({
      ads: rewardedAds,
      telemetry: this.writesSave ? services.telemetry : undefined,
      wallet: gameState,
      player: gameState,
    });

    const { width, height } = this.scale.gameSize;
    this.background = new Backdrop(this, TRAY_TOP_Y, width, height, this.sim.state, setup.look);
    const look = setup.look;
    this.fx = new RunFx(this, TRAY_TOP_Y, this.seed, look.weather, setup.goals, setup.startHeight);
    this.weather = new RunWeather(this, look.weather, this.seed, this.background, this.fx.tower);
    this.fx.setBackdrop(this.background);
    this.fx.onFlySwatted = () => {
      this.tally.flies += 1;
    };
    watchRunSky(this, () => this.background.topSkyColor());
    if (import.meta.env.DEV) installSquashDebug(this, this.sim, this.fx.tower);
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
      () => restartRun(this, this.request),
    );
    // The system may unload the app in the background without a page close: a draft keeps the run.
    const unbindDraft = bindRunDraft(
      this.game.events,
      { hidden: Phaser.Core.Events.HIDDEN, visible: Phaser.Core.Events.VISIBLE },
      () => this.recorder,
      () => this.sim,
    );
    const freezeBackdrop = (): void => this.background.freeze();
    this.events.on(RESULTS_SETTLED, freezeBackdrop);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      trimHudPlates(this);
      this.events.off(RESULTS_SETTLED, freezeBackdrop);
      unbindLeave();
      unbindDraft();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.continueFlow?.dispose();
      this.recorder.recordQuit(this.sim);
      this.recorder.dropDraft();
      dropHeldResults(this);
    });

    this.camera.setEntry(enterWorld(this));
    // Sync once so the tower height is known, then jump the camera to its target.
    this.fx.update(0, 0, this.sim.state, this.mods, this.camera.cameraInfo());
    // A run that starts on a built tower opens with the camera rising along it (not in a demo).
    if (this.request.kind !== 'demo') {
      this.camera.startIntro(
        new RunIntro(this.startHeight, effectsMode.reduced, easeFn(ANIM.runIntro.ease)),
      );
    }
    this.camera.snap();
    this.results.begin(this);
  }

  override update(time: number, delta: number): void {
    this.flying.note(this.sim.state);

    // The tutorial holds the sim for a moment while it explains the creature layer.
    this.tutorial?.tick(delta);
    const held = (this.tutorial?.holding ?? false) || this.camera.introActive;
    // What the drop that lands in this step is resolved with: read before the step, while its layer still flies.
    let dropMods = this.sim.flyingModifiers();
    const events = held ? [] : this.sim.update(delta);
    if (this.drivers.shouldDrop(events, this.sim, held)) {
      dropMods = this.sim.flyingModifiers();
      events.push(...this.sim.drop());
    }
    if (this.sim.state.phase === 'flying') this.results.bakeStep();
    this.fx.tower.prepareLanding(this.sim);
    this.tutorial?.observe(events, this.sim.state);
    driveContinue(
      {
        flow: this.continueFlow,
        sim: this.sim,
        mode: this.mode,
        noContinue: this.noContinue,
        canDecline: this.fx.canDecline,
      },
      delta,
      events,
    );
    // Berries go to the save the moment they are earned: they can pay for this run's continue.
    if (this.writesSave) gameState.addBerries(berriesFromEvents(events));
    tallyEvents(this.tally, events);
    this.tally.maxWobble = Math.max(this.tally.maxWobble, this.sim.state.wobble);
    this.recorder.recordFinished(events);
    this.watchDemo();

    const cam = this.camera.cameraInfo();
    this.fx.handleEvents(events, this.sim.state, this.flying.current, dropMods, cam);
    if (events.length > 0) this.mods = this.sim.currentModifiers();
    this.fx.update(delta, time, this.sim.state, this.mods, cam);
    fxGuard.run('backdrop-zone', () => this.background.follow(this.sim.state));
    fxGuard.run('weather', () => {
      const { width, height } = this.scale.gameSize;
      this.weather?.update(time, delta, width, height, this.sim.state);
    });
    // Slow motion slows the tweens and the camera too; the HUD scene keeps its own clock.
    this.tweens.timeScale = this.fx.timeScale;
    this.camera.follow(delta * this.fx.timeScale);
    if (this.tutorial) {
      placeTutorialTarget(this.tutorial, this.fx, this.camera, this.cameras.main);
    }

    // The run is over and recorded: the results screen builds itself hidden while the tower falls.
    for (const event of events) {
      if (event.type === 'run_over') this.openResults(event.result);
    }
    if (!this.fx.takeResult()) return;
    if (this.request.kind === 'demo') {
      this.leaveRun();
      return;
    }
    revealResults(this);
  }

  /** The run is over: the results scene starts and builds itself hidden (a demo has none). */
  private openResults(result: RunResult): void {
    if (this.request.kind === 'demo') return;
    const outcome = {
      result,
      recorder: this.recorder,
      tally: this.tally,
      tower: this.fx.tower.snapshot(),
      startHeight: this.startHeight,
      checkpoint: this.checkpoint,
      recorded: this.writesSave,
    };
    this.results.open(this, outcome, this.perfRun);
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

  /** A look at the run for the `?perf=1` director: the intro is over, the sim state and whether two zones cross-fade. */
  perfProbe(): { introActive: boolean; state: Readonly<TowerState>; zoneFading: boolean } | null {
    return this.sim
      ? {
          introActive: this.camera.introActive,
          state: this.sim.state,
          zoneFading: this.background.fading,
        }
      : null;
  }

  /** The master effects that acted, for the captions of the HUD. */
  get masterFeed(): MasterFeed {
    return this.fx.masterFeed;
  }

  /** The state of the run for the HUD. The object is reused: read it at once, do not keep it. */
  getRunInfo(): Readonly<RunInfo> | null {
    if (!this.sim) return null;
    return fillRunInfo(
      this.runInfo,
      this.sim.state,
      this.seed,
      this.team,
      this.sys.isPaused(),
      this.mode,
    );
  }

  /** Taps do not drop a layer while a hint explains, the camera rises along the built tower or the demo ends. */
  private get inputBlocked(): boolean {
    return (this.tutorial?.holding ?? false) || this.camera.introActive || this.demoLeaving;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (isOverUi(pointer.x, pointer.y) || this.inputBlocked) return;
    this.sim.drop();
  }

  private onDropKey(event: KeyboardEvent): void {
    // Holding the key must not drop every new layer the moment it appears.
    if (event.repeat || this.inputBlocked) return;
    this.sim.drop();
  }

  private onResize(): void {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    this.background.resize(width, height);
    this.fx.resize(width, height);
  }
}
