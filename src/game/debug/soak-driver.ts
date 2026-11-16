import * as Phaser from 'phaser';
import { SOAK } from '../../data/soak';
import { setLang, type Lang } from '../../i18n';
import { CLASSIC_RUN, DAILY_RUN, demoRun, type RunRequest } from '../run-request';
import { openScreen, restartRun, SCENES, startRunFrom, type SceneKey } from '../scene-keys';
import type { GameScene } from '../scenes/game-scene';
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
  /** Parked on Home between two laps, waiting for `release()`. */
  parked: boolean;
  /** Where the driver is now, for the log. */
  stage: string;
}

export interface TippySoak {
  /** Starts the lap loop (once). */
  start(): void;
  stop(): void;
  status(): SoakStatus;
  /** The next time the driver is at Home between laps it parks there until `release()`. */
  parkNext(): void;
  release(): void;
  sample(): SoakSample;
}

type SoakWindow = Window & { tippySoak?: TippySoak };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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
    parked: false,
    stage: 'idle',
  };

  constructor(private readonly game: Phaser.Game) {}

  start(): void {
    if (this.active) return;
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

  private isOn(key: SceneKey): boolean {
    return this.game.scene.isActive(key);
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

  /** A `?bot=` page opens with a run: let it end (or leave it) and get to Home. */
  private async toHome(): Promise<void> {
    this.stage('to-home');
    await this.waitFor(() => this.isOn(SCENES.home) || this.isOn(SCENES.results), SOAK.runMaxMs);
    if (this.isOn(SCENES.home)) return;
    if (this.isOn(SCENES.results)) openScreen(this.scene(SCENES.results), SCENES.home);
    else (this.scene(SCENES.game) as GameScene).leaveRun();
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
    await sleep(SOAK.screenDwellMs);
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
    startRunFrom(this.scene(from), request);
  }

  /** Runs until the results: two full ones with "Play again" between, then one abandoned by a restart. */
  private async playRuns(): Promise<void> {
    this.stage('run');
    this.beginRun(SCENES.home, CLASSIC_RUN);
    for (let run = 1; run < SOAK.runsPerLap && this.active; run++) {
      const reached = await this.waitFor(() => this.isOn(SCENES.results), SOAK.runMaxMs);
      if (reached) {
        this.counts.results += 1;
        this.stage('results');
        await sleep(SOAK.resultsDwellMs);
        this.counts.runs += 1;
        startRunFrom(this.scene(SCENES.results), CLASSIC_RUN);
      } else {
        this.counts.abandoned += 1;
        this.counts.runs += 1;
        restartRun(this.scene(SCENES.game));
      }
    }
    // The last run is left half-way, through the pause window's two exits: restart, then leave.
    this.stage('abandon');
    await sleep(SOAK.abandonAfterMs);
    // The page going to the background opens the pause window, as it does for a player.
    this.game.events.emit(Phaser.Core.Events.HIDDEN);
    await sleep(SOAK.screenDwellMs);
    this.counts.runs += 1;
    restartRun(this.scene(SCENES.game));
    await sleep(SOAK.abandonAfterMs);
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
    await sleep(SOAK.screenDwellMs);
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
      await sleep(SOAK.resultsDwellMs);
      openScreen(this.scene(SCENES.results), SCENES.daily);
    } else {
      this.counts.abandoned += 1;
      (this.scene(SCENES.game) as GameScene).leaveRun();
    }
    await this.waitFor(() => this.isOn(SCENES.daily), SOAK.runMaxMs);
    await sleep(SOAK.screenDwellMs);
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
    await sleep(SOAK.screenDwellMs);
  }
}

/** Dev only: exposes `window.tippySoak` (see `docs/08-architecture.md`, section 9). */
export function registerSoak(game: Phaser.Game): void {
  (window as SoakWindow).tippySoak = new SoakDriver(game);
}
