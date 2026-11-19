import * as Phaser from 'phaser';
import { CHECKPOINT_HEIGHTS } from '../../core/zones/checkpoints';
import { CREATURE_IDS } from '../../data/creatures/creatures';
import { SOAK } from '../../data/debug/soak';
import { services } from '../../services';
import { gameState } from '../../state';
import { setLang, type Lang } from '../../i18n';
import {
  checkpointRun,
  CLASSIC_RUN,
  DAILY_RUN,
  demoRun,
  type RunRequest,
} from '../run/run-request';
import {
  openScreen,
  restartRun,
  resultsShown,
  SCENES,
  startRunFrom,
  type SceneKey,
} from '../app/scene-keys';
import type { LickScene } from '../objects/glaze/lick-plan';
import { runHooks } from '../perf/run-hooks';
import type { GameScene } from '../scenes/game-scene';
import { setSoakSpeed } from './soak-speed';
import { differing, type SmokeCounts } from './soak-compare';
import { readSoakSample, type SoakSample } from './soak-metrics';
import { resultsDemoData } from './results-demo';

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
  /** Runs in which a Rainbow joke played. */
  jokes: number;
  /** Runs in which the Rainbow arc grew out. */
  arcs: number;
  /** Checkpoint runs of the laps (one per lap, the checkpoints in turn, so every zone is played). */
  zoneRuns: number;
  /** Record results screens shown (its celebration and music played). */
  records: number;
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
/** The steps of the smoke lap, in order. */
const SMOKE_STEPS = [
  'team',
  'run-licks-rainbow',
  'results-again',
  'pause-restart',
  'checkpoint-run',
  'daily',
  'shop',
  'collection-creature',
  'settings-language',
] as const;
type SmokeStep = (typeof SMOKE_STEPS)[number];

export interface SmokeReport {
  /** Every step done and the counts equal. */
  ok: boolean;
  /** Names of the counts that differ before and after (empty when equal). */
  differing: string[];
  steps: Array<{ name: string; ok: boolean }>;
  before: SmokeCounts;
  after: SmokeCounts;
  seconds: number;
  /** Licks, jokes and arcs of the whole driver so far (`SoakStatus` counters; the steps use deltas). */
  status: SoakStatus;
}

type SoakWindow = Window & { tippySoak?: TippySoak };

/** The pauses of the soak laps; the smoke lap swaps them for `SOAK.smoke` ones. */
interface Dwell {
  screenMs: number;
  resultsMs: number;
  abandonMs: number;
}

const DEFAULT_DWELL: Readonly<Dwell> = {
  screenMs: SOAK.screenDwellMs,
  resultsMs: SOAK.resultsDwellMs,
  abandonMs: SOAK.abandonAfterMs,
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Buys and upgrades every creature, puts a full team on the run and ends the first runs, so the menus show a rich save. */
function enrichSave(): void {
  gameState.debugSetBakerLevel(SOAK.richBakerLevel);
  gameState.debugSetRuns(SOAK.richRuns);
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
    zoneRuns: 0,
    records: 0,
    parked: false,
    stage: 'idle',
  };

  private dwell: Dwell = { ...DEFAULT_DWELL };

  constructor(private readonly game: Phaser.Game) {}

  start(rich = false): void {
    if (this.active) return;
    // The audio graph runs during a soak, so its nodes are part of what is checked.
    services.audio.unlock();
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
    if (this.active)
      throw new Error('tippySoak.smoke(): the soak loop is running, stop() it first');
    const started = performance.now();
    services.audio.unlock();
    const steps: SmokeReport['steps'] = [];
    const once = (): SmokeCounts => {
      const { objects, listeners, lastingTweens, tweens, timers, audioNodes } = this.sample();
      return { objects, listeners, tweens: lastingTweens, rawTweens: tweens, timers, audioNodes };
    };
    // Entrance tweens of a screen still run for a moment, and a Home has short idle tweens that
    // come and go: only lasting tweens are counted (a short one caught mid-flight is not a leak),
    // read until two reads in a row agree (at least `settleMinReads` reads), and take the fewest
    // tweens seen, as a tween that is left behind does not go away.
    const read = async (): Promise<SmokeCounts> => {
      let last = once();
      let tweens = last.tweens;
      let audioNodes = last.audioNodes;
      for (let i = 0; i < SOAK.smoke.settleReads; i++) {
        await sleep(SOAK.smoke.settleMs);
        const next = once();
        const same = differing(last, next).length === 0;
        last = next;
        tweens = Math.min(tweens, next.tweens);
        // Sounds in flight end, a node that is left behind does not: the fewest seen counts.
        audioNodes = Math.min(audioNodes, next.audioNodes);
        if (same && i + 1 >= SOAK.smoke.settleMinReads) break;
      }
      return { ...last, tweens, audioNodes };
    };
    const step = async (name: SmokeStep, body: () => Promise<boolean>): Promise<void> => {
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
    setSoakSpeed(this.game, SOAK.smoke.speed);
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
      // The lap ends on a Home opened from Home (the settings step) with the team of the team
      // step: open it the same way now, so the counts before and after are read on the same Home.
      gameState.setTeam([...SOAK.teams[SOAK.smoke.teamIndex]!]);
      await this.visit(SCENES.home, SCENES.home);
      await sleep(this.dwell.screenMs);
      before = await read();
      await step('team', async () => {
        await this.changeTeam(SOAK.smoke.teamIndex);
        return home();
      });
      await step('run-licks-rainbow', async () => {
        // The counters are the driver's totals: this step needs what its own runs added. The bot
        // misses at random, so a run may end before the Rainbow layer (layer 6) comes: try again.
        const from = { ...this.counts };
        let at: SceneKey = SCENES.home;
        for (let attempt = 1; attempt <= SOAK.smoke.rainbowAttempts; attempt++) {
          this.beginRun(at, CLASSIC_RUN);
          if (!(await results())) return false;
          // The poke polls: give it one more look at the run that has just ended.
          await sleep(SOAK.pokeMs * 4);
          const c = this.counts;
          const done =
            c.bigLicks > from.bigLicks &&
            c.shortLicks > from.shortLicks &&
            c.jokes > from.jokes &&
            c.arcs > from.arcs;
          if (done) return true;
          this.counts.results += 1;
          await sleep(this.dwell.resultsMs);
          at = SCENES.results;
        }
        return false;
      });
      await step('results-again', async () => {
        this.counts.results += 1;
        await sleep(this.dwell.resultsMs);
        this.beginRun(SCENES.results, CLASSIC_RUN);
        return live();
      });
      await step('pause-restart', async () => {
        // At the accelerated speed the run may already be over: begin a fresh one if so.
        if (!this.runLive()) {
          if (this.isOn(SCENES.results)) this.beginRun(SCENES.results, CLASSIC_RUN);
          else if (home()) this.beginRun(SCENES.home, CLASSIC_RUN);
          if (!(await live())) return false;
        }
        await sleep(this.dwell.abandonMs);
        if (!this.runLive()) return false;
        this.game.events.emit(Phaser.Core.Events.HIDDEN);
        if (!(await this.waitFor(() => this.game.scene.isPaused(SCENES.game), SOAK.runMaxMs))) {
          return false;
        }
        // The page comes back, as it does for a player: the sound held for the background resumes.
        this.game.events.emit(Phaser.Core.Events.VISIBLE);
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
      setSoakSpeed(this.game, 1);
      this.active = false;
      this.counts.running = false;
      this.dwell = { ...DEFAULT_DWELL };
    }
    const unequal = differing(before, after);
    return {
      ok: steps.length === SMOKE_STEPS.length && steps.every((s) => s.ok) && unequal.length === 0,
      differing: unequal,
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
  private async waitFor(
    done: () => boolean,
    timeoutMs: number,
    pollMs: number = SOAK.pollMs,
  ): Promise<boolean> {
    const until = performance.now() + timeoutMs;
    while (this.active && performance.now() < until) {
      if (done()) return true;
      await sleep(pollMs);
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
    await this.zoneRun();
    await this.tour();
  }

  /**
   * A run from the next checkpoint in turn (20, 40, … so every zone and its change are played),
   * then the record results: bot runs never reach the save, so they never set a record, and the
   * record celebration and its music come from the `?resultsDemo=record` screen instead.
   */
  private async zoneRun(): Promise<void> {
    if (!this.active) return;
    const heights = CHECKPOINT_HEIGHTS;
    const height = heights[this.counts.zoneRuns % heights.length]!;
    this.stage(`zone-${height}`);
    this.counts.zoneRuns += 1;
    this.beginRun(SCENES.home, checkpointRun(height));
    const reached = await this.waitFor(() => this.isOn(SCENES.results), SOAK.zoneRunMaxMs);
    // Stopped while waiting: leave the game where it is, count nothing.
    if (!this.active) return;
    if (reached) {
      this.counts.results += 1;
      await sleep(this.dwell.resultsMs);
      openScreen(this.scene(SCENES.results), SCENES.home);
    } else if (this.runLive()) {
      this.counts.abandoned += 1;
      (this.scene(SCENES.game) as GameScene).leaveRun();
    }
    await this.waitFor(() => this.isOn(SCENES.home), SOAK.runMaxMs);
    if (!this.active || !this.isOn(SCENES.home)) return;
    await this.visit(SCENES.home, SCENES.results, resultsDemoData('record'));
    if (!this.isOn(SCENES.results)) return;
    this.counts.records += 1;
    await sleep(SOAK.recordDwellMs);
    await this.visit(SCENES.results, SCENES.home);
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
  private async changeTeam(index = this.counts.teamChanges): Promise<void> {
    await this.visit(SCENES.home, SCENES.team);
    const teams = SOAK.teams;
    gameState.setTeam([...teams[index % teams.length]!]);
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
    let joke = false;
    const watch = (): void => {
      if (!arc && live() && hooks.arcGrown()) {
        arc = true;
        this.counts.arcs += 1;
      }
      if (!joke && live() && hooks.jokesPlayed() > 0) {
        joke = true;
        this.counts.jokes += 1;
      }
    };
    // The next Rainbow star tells its joke as soon as one is on screen; it counts once it played.
    hooks.rainbowJoke();
    // Whenever no lick plays, the scenes still to do are tried, the big one first.
    const left = new Set<LickScene>(['big', 'short']);
    await this.waitFor(
      () => {
        watch();
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
      },
      SOAK.runMaxMs,
      SOAK.pokeMs,
    );
    await this.waitFor(
      () => {
        watch();
        return !live();
      },
      SOAK.runMaxMs,
      SOAK.pokeMs,
    );
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
    this.game.events.emit(Phaser.Core.Events.VISIBLE);
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
