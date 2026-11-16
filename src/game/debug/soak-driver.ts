import * as Phaser from 'phaser';
import { CHECKPOINT_HEIGHTS } from '../../core/checkpoints';
import { CREATURE_IDS } from '../../data/creatures';
import { SOAK } from '../../data/soak';
import { gameState } from '../../state';
import { setLang, type Lang } from '../../i18n';
import { checkpointRun, CLASSIC_RUN, DAILY_RUN, demoRun, type RunRequest } from '../run-request';
import {
  openScreen,
  restartRun,
  resultsShown,
  SCENES,
  startRunFrom,
  type SceneKey,
} from '../scene-keys';
import type { LickScene } from '../objects/lick-plan';
import { runHooks } from '../perf/run-hooks';
import type { GameScene } from '../scenes/game-scene';
import { setSoakSpeed } from './soak-speed';
import { readSoakSample, type SoakSample } from './soak-metrics';

/** What the harness reads between laps. */
export interface SoakStatus {
  running: boolean;
  /** Laps finished so far. */
  laps: number;
  /** Runs started so far, restarts and abandoned runs included. */
  runs: number;
  /** Runs that reached the results screen. */
  results: number;
  /** Runs left through the pause path (they never reached the results). */
  abandoned: number;
  /** Teams set on the team screen. */
  teamChanges: number;
  /** Licks the driver started in the runs, by scene. */
  bigLicks: number;
  shortLicks: number;
  /** Rainbow jokes asked for (one per run). */
  jokes: number;
  /** Runs in which the Rainbow arc grew out. */
  arcs: number;
  /** Parked on Home between two laps, waiting for `release()`. */
  parked: boolean;
  /** Where the driver is now, for the log. */
  stage: string;
}

export interface TippySoak {
  /** Starts the lap loop (once). `rich` first fills the save: every creature bought and upgraded, a full team. */
  start(rich?: boolean): void;
  stop(): void;
  status(): SoakStatus;
  /** The next time the driver is at Home between laps it parks there until `release()`. */
  parkNext(): void;
  release(): void;
  sample(): SoakSample;
  /** One fixed lap through every screen and run kind at accelerated game time; see `SmokeReport`. */
  smoke(): Promise<SmokeReport>;
}

/** The numbers that must be equal at Home before and after the smoke lap. */
export interface SmokeCounts {
  objects: number;
  listeners: number;
  tweens: number;
  timers: number;
}

export interface SmokeReport {
  /** Every step done and the counts equal. */
  ok: boolean;
  steps: Array<{ name: string; ok: boolean }>;
  before: SmokeCounts;
  after: SmokeCounts;
  seconds: number;
  /** Licks, jokes and arcs seen in the lap (`SoakStatus` counters). */
  status: SoakStatus;
}

type SoakWindow = Window & { tippySoak?: TippySoak };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Buys and upgrades every creature and puts a full team on the run, so the menus show a rich save. */
function enrichSave(): void {
  gameState.addCoins(SOAK.richCoins);
  gameState.addBerries(SOAK.richBerries);
  for (const id of CREATURE_IDS) {
    if (!gameState.buyCreature(id, 'coins').ok) gameState.buyCreature(id, 'berries');
    for (let step = 0; step < SOAK.richUpgrades; step++) {
      if (!gameState.upgradeCreature(id).ok) break;
    }
  }
  gameState.setTeam(CREATURE_IDS.slice(0, SOAK.richTeamSize));
}

/** Plays laps of: runs with restarts, a quit through the pause path, a tour of the menu screens. */
class SoakDriver implements TippySoak {
  private active = false;
  private parkRequested = false;
  private releaseResolve: (() => void) | null = null;
  private readonly counts: SoakStatus = {
    running: false,
    laps: 0,
    runs: 0,
    results: 0,
    abandoned: 0,
    teamChanges: 0,
    bigLicks: 0,
    shortLicks: 0,
    jokes: 0,
    arcs: 0,
    parked: false,
    stage: 'idle',
  };

  private dwell: { screenMs: number; resultsMs: number; abandonMs: number } = {
    screenMs: SOAK.screenDwellMs,
    resultsMs: SOAK.resultsDwellMs,
    abandonMs: SOAK.abandonAfterMs,
  };

  constructor(private readonly game: Phaser.Game) {}

  start(rich = false): void {
    if (this.active) return;
    if (rich) enrichSave();
    this.active = true;
    this.counts.running = true;
    void this.loop();
  }

  stop(): void {
    this.active = false;
    this.counts.running = false;
    this.release();
  }

  status(): SoakStatus {
    return { ...this.counts };
  }

  parkNext(): void {
    this.parkRequested = true;
  }

  release(): void {
    this.releaseResolve?.();
  }

  sample(): SoakSample {
    return readSoakSample(this.game);
  }

  /** Home reached, the save rich, the game time sped up: one pass through the fixed list of steps. */
  async smoke(): Promise<SmokeReport> {
    const started = performance.now();
    const steps: SmokeReport['steps'] = [];
    const once = (): SmokeCounts => {
      const { objects, listeners, tweens, timers } = this.sample();
      return { objects, listeners, tweens, timers };
    };
    // Entrance tweens of a screen still run for a moment: read until two reads in a row agree.
    const read = async (): Promise<SmokeCounts> => {
      let last = once();
      for (let i = 0; i < SOAK.smoke.settleReads; i++) {
        await sleep(SOAK.smoke.settleMs);
        const next = once();
        const same =
          next.objects === last.objects &&
          next.listeners === last.listeners &&
          next.tweens === last.tweens;
        last = next;
        if (same) break;
      }
      return last;
    };
    const step = async (name: string, body: () => Promise<boolean>): Promise<void> => {
      this.stage(`smoke-${name}`);
      let ok: boolean;
      try {
        ok = await body();
      } catch {
        ok = false;
      }
      steps.push({ name, ok });
    };
    this.active = true;
    this.counts.running = true;
    enrichSave();
    this.dwell = {
      screenMs: SOAK.smoke.screenDwellMs,
      resultsMs: SOAK.smoke.resultsDwellMs,
      abandonMs: SOAK.smoke.abandonAfterMs,
    };
    setSoakSpeed(SOAK.smoke.speed);
    const home = (): boolean => this.isOn(SCENES.home);
    const game = (): GameScene => this.scene(SCENES.game) as GameScene;
    const live = (): Promise<boolean> => this.waitFor(() => this.runLive(), SOAK.runMaxMs);
    const results = (): Promise<boolean> =>
      this.waitFor(() => this.isOn(SCENES.results), SOAK.runMaxMs);
    const leave = async (): Promise<boolean> => {
      game().leaveRun();
      return this.waitFor(home, SOAK.runMaxMs);
    };
    let before: SmokeCounts;
    let after: SmokeCounts;
    try {
      await this.toHome();
      await sleep(this.dwell.screenMs);
      before = await read();
      await step('team', async () => {
        await this.changeTeam();
        return home();
      });
      await step('run-licks-rainbow', async () => {
        this.beginRun(SCENES.home, CLASSIC_RUN);
        const reached = await results();
        const c = this.counts;
        // The arc grows on its own clock: `arcs` is reported, not required.
        return reached && c.bigLicks >= 1 && c.shortLicks >= 1 && c.jokes >= 1;
      });
      await step('results-again', async () => {
        this.counts.results += 1;
        await sleep(this.dwell.resultsMs);
        this.beginRun(SCENES.results, CLASSIC_RUN);
        return live();
      });
      await step('pause-restart', async () => {
        await sleep(this.dwell.abandonMs);
        this.game.events.emit(Phaser.Core.Events.HIDDEN);
        await sleep(this.dwell.screenMs);
        this.counts.runs += 1;
        this.pokeNextRun();
        restartRun(game());
        return live();
      });
      await step('checkpoint-run', async () => {
        if (!(await leave())) return false;
        const height = CHECKPOINT_HEIGHTS[SOAK.smoke.checkpointIndex]!;
        this.beginRun(SCENES.home, checkpointRun(height));
        if (!(await live())) return false;
        await sleep(this.dwell.abandonMs);
        return leave();
      });
      await step('daily', async () => {
        await this.visit(SCENES.home, SCENES.daily);
        await this.dailyRun();
        return home();
      });
      await step('shop', async () => {
        await this.visit(SCENES.home, SCENES.shop);
        await this.visit(SCENES.shop, SCENES.home);
        return home();
      });
      await step('collection-creature', async () => {
        await this.visit(SCENES.home, SCENES.collection);
        await this.visit(SCENES.collection, SCENES.creatureDetail, {
          id: 'honey',
          back: 'collection',
        });
        await this.visit(SCENES.creatureDetail, SCENES.collection);
        await this.visit(SCENES.collection, SCENES.home);
        return home();
      });
      await step('settings-language', async () => {
        await this.settingsAndLanguage();
        return home();
      });
      await sleep(this.dwell.screenMs);
      after = await read();
    } finally {
      setSoakSpeed(1);
      this.active = false;
      this.counts.running = false;
      this.dwell = {
        screenMs: SOAK.screenDwellMs,
        resultsMs: SOAK.resultsDwellMs,
        abandonMs: SOAK.abandonAfterMs,
      };
    }
    const equal =
      before.objects === after.objects &&
      before.listeners === after.listeners &&
      before.tweens === after.tweens;
    return {
      ok: steps.length === 9 && steps.every((s) => s.ok) && equal,
      steps,
      before,
      after,
      seconds: Math.round((performance.now() - started) / 100) / 10,
      status: this.status(),
    };
  }

  private isOn(key: SceneKey): boolean {
    return key === SCENES.results ? resultsShown(this.game.scene) : this.game.scene.isActive(key);
  }

  private scene(key: SceneKey): Phaser.Scene {
    return this.game.scene.getScene(key);
  }

  private stage(name: string): void {
    this.counts.stage = name;
  }

  /** Waits until `done()` or the time is up; false on the time-out. */
  private async waitFor(done: () => boolean, timeoutMs: number): Promise<boolean> {
    const until = performance.now() + timeoutMs;
    while (this.active && performance.now() < until) {
      if (done()) return true;
      await sleep(SOAK.pollMs);
    }
    return this.active && done();
  }

  private async loop(): Promise<void> {
    await this.toHome();
    while (this.active) {
      await this.lap();
      this.counts.laps += 1;
    }
  }

  /** A run of the game scene that is being played: past its intro, not over (results may be building). */
  private runLive(): boolean {
    if (!this.game.scene.isActive(SCENES.game) || runHooks() === null) return false;
    const probe = (this.scene(SCENES.game) as GameScene).perfProbe();
    return probe !== null && !probe.introActive && probe.state.phase !== 'over';
  }

  /**
   * A `?bot=` page opens with a run: leave it once it is up and its screen has come in (waiting
   * for its end made the first lap start late, and never under load) and get to Home. A run that
   * has already ended is waited out briefly: its results or Home follow.
   */
  private async toHome(): Promise<void> {
    this.stage('to-home');
    const out = (): boolean => this.isOn(SCENES.home) || this.isOn(SCENES.results);
    await this.waitFor(() => out() || this.runLive(), SOAK.runMaxMs);
    if (!out() && this.runLive()) {
      await sleep(SOAK.hudEnterMs);
      if (!this.runLive()) await this.waitFor(out, SOAK.endedWaitMs);
    }
    if (this.isOn(SCENES.home)) return;
    if (this.isOn(SCENES.results)) openScreen(this.scene(SCENES.results), SCENES.home);
    else if (this.runLive()) (this.scene(SCENES.game) as GameScene).leaveRun();
    await this.waitFor(() => this.isOn(SCENES.home), SOAK.runMaxMs);
  }

  private async lap(): Promise<void> {
    await this.parkIfAsked();
    await this.playRuns();
    await this.tour();
  }

  /** Between laps, at Home: holds still while the harness reads the counts. */
  private async parkIfAsked(): Promise<void> {
    this.stage('home');
    await sleep(this.dwell.screenMs);
    if (!this.parkRequested || !this.active) return;
    this.parkRequested = false;
    this.counts.parked = true;
    await new Promise<void>((resolve) => {
      this.releaseResolve = resolve;
    });
    this.releaseResolve = null;
    this.counts.parked = false;
  }

  private beginRun(from: SceneKey, request: RunRequest): void {
    this.counts.runs += 1;
    this.pokeNextRun();
    startRunFrom(this.scene(from), request);
  }

  /** Goes to the team screen, sets the next team of `SOAK.teams` and comes back to Home. */
  private async changeTeam(): Promise<void> {
    await this.visit(SCENES.home, SCENES.team);
    const teams = SOAK.teams;
    gameState.setTeam([...teams[this.counts.teamChanges % teams.length]!]);
    this.counts.teamChanges += 1;
    await this.visit(SCENES.team, SCENES.home);
  }

  /**
   * In the run that starts next: the Rainbow joke, then the big and the short lick as soon as the
   * tower lets a layer lick; a grown Rainbow arc is counted. Stops when that run ends.
   */
  private pokeNextRun(): void {
    void this.pokeRun(runHooks());
  }

  private async pokeRun(previous: ReturnType<typeof runHooks>): Promise<void> {
    // The run that starts registers its hooks on create; the previous run's are cleared on shutdown.
    const started = await this.waitFor(() => {
      const hooks = runHooks();
      return hooks !== null && hooks !== previous;
    }, SOAK.runMaxMs);
    const hooks = runHooks();
    if (!started || !hooks) return;
    const live = (): boolean => this.active && runHooks() === hooks;
    let arc = false;
    const watchArc = (): void => {
      if (arc || !live() || !hooks.arcGrown()) return;
      arc = true;
      this.counts.arcs += 1;
    };
    // The next Rainbow star tells its joke as soon as one is on screen.
    hooks.rainbowJoke();
    this.counts.jokes += 1;
    // Whenever no lick plays, the scenes still to do are tried, the big one first.
    const left = new Set<LickScene>(['big', 'short']);
    await this.waitFor(() => {
      watchArc();
      if (!live()) return true;
      if (hooks.lickStage() !== null) return false;
      for (const scene of left) {
        if (!hooks.lick(scene)) continue;
        left.delete(scene);
        if (scene === 'big') this.counts.bigLicks += 1;
        else this.counts.shortLicks += 1;
        break;
      }
      return left.size === 0;
    }, SOAK.runMaxMs);
    await this.waitFor(() => {
      watchArc();
      return !live();
    }, SOAK.runMaxMs);
  }

  /**
   * A team change, then runs until the results: two full ones with "Play again" between, then one
   * abandoned by a restart. Every run gets its licks and the Rainbow joke (`pokeRun`).
   */
  private async playRuns(): Promise<void> {
    this.stage('team');
    await this.changeTeam();
    this.stage('run');
    this.beginRun(SCENES.home, CLASSIC_RUN);
    for (let run = 1; run < SOAK.runsPerLap && this.active; run++) {
      const reached = await this.waitFor(() => this.isOn(SCENES.results), SOAK.runMaxMs);
      if (reached) {
        this.counts.results += 1;
        this.stage('results');
        await sleep(this.dwell.resultsMs);
        this.beginRun(SCENES.results, CLASSIC_RUN);
      } else {
        this.counts.abandoned += 1;
        this.counts.runs += 1;
        this.pokeNextRun();
        restartRun(this.scene(SCENES.game));
      }
    }
    // The last run is left half-way, through the pause window's two exits: restart, then leave.
    this.stage('abandon');
    await sleep(this.dwell.abandonMs);
    // The page going to the background opens the pause window, as it does for a player.
    this.game.events.emit(Phaser.Core.Events.HIDDEN);
    await sleep(this.dwell.screenMs);
    this.counts.runs += 1;
    this.pokeNextRun();
    restartRun(this.scene(SCENES.game));
    await sleep(this.dwell.abandonMs);
    this.counts.abandoned += 1;
    (this.scene(SCENES.game) as GameScene).leaveRun();
    await this.waitFor(() => this.isOn(SCENES.home), SOAK.runMaxMs);
  }

  /** Home, Shop, Collection, a creature card with its demo run, Team, the daily tower, and back to Home. */
  private async tour(): Promise<void> {
    await this.visit(SCENES.home, SCENES.shop);
    await this.visit(SCENES.shop, SCENES.home);
    await this.visit(SCENES.home, SCENES.collection);
    await this.visit(SCENES.collection, SCENES.creatureDetail, { id: 'honey', back: 'collection' });
    this.stage('demo');
    startRunFrom(this.scene(SCENES.creatureDetail), demoRun('honey', 1, 'collection'));
    await this.waitFor(() => this.isOn(SCENES.creatureDetail), SOAK.runMaxMs);
    await sleep(this.dwell.screenMs);
    await this.visit(SCENES.creatureDetail, SCENES.collection);
    await this.visit(SCENES.collection, SCENES.home);
    await this.visit(SCENES.home, SCENES.team);
    await this.visit(SCENES.team, SCENES.home);
    await this.visit(SCENES.home, SCENES.daily);
    await this.dailyRun();
    await this.visit(SCENES.home, SCENES.newCreature, {
      creatures: ['honey'],
      then: { kind: 'screen', key: SCENES.home },
    });
    await this.waitFor(
      () => this.isOn(SCENES.home) || this.isOn(SCENES.newCreature),
      SOAK.runMaxMs,
    );
    await this.settingsAndLanguage();
  }

  /** A daily run from the daily screen, played until its results, then back to Home. */
  private async dailyRun(): Promise<void> {
    this.stage('daily-run');
    this.beginRun(SCENES.daily, DAILY_RUN);
    const reached = await this.waitFor(() => this.isOn(SCENES.results), SOAK.runMaxMs);
    if (reached) {
      this.counts.results += 1;
      await sleep(this.dwell.resultsMs);
      openScreen(this.scene(SCENES.results), SCENES.daily);
    } else {
      this.counts.abandoned += 1;
      (this.scene(SCENES.game) as GameScene).leaveRun();
    }
    await this.waitFor(() => this.isOn(SCENES.daily), SOAK.runMaxMs);
    await sleep(this.dwell.screenMs);
    await this.visit(SCENES.daily, SCENES.home);
  }

  /** Home is rebuilt with the settings window open, once in the other language and once back. */
  private async settingsAndLanguage(): Promise<void> {
    if (!this.isOn(SCENES.home)) openScreen(this.scene(SCENES.newCreature), SCENES.home);
    await this.waitFor(() => this.isOn(SCENES.home), SOAK.runMaxMs);
    for (const lang of SOAK.languages as readonly Lang[]) {
      this.stage(`settings-${lang}`);
      setLang(lang);
      await this.visit(SCENES.home, SCENES.home, { reopenSettings: true });
    }
    await this.visit(SCENES.home, SCENES.home);
  }

  /** Opens `to` from `from` and looks at it for a moment. */
  private async visit(from: SceneKey, to: SceneKey, data: object = {}): Promise<void> {
    if (!this.active) return;
    this.stage(to);
    openScreen(this.scene(from), to, data);
    await this.waitFor(() => this.isOn(to), SOAK.runMaxMs);
    await sleep(this.dwell.screenMs);
  }
}

/** Dev only: exposes `window.tippySoak` (see `docs/08-architecture.md`, section 9). */
export function registerSoak(game: Phaser.Game): void {
  (window as SoakWindow).tippySoak = new SoakDriver(game);
}
