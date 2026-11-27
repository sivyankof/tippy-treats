import * as Phaser from 'phaser';
import { ANIM } from '../../data/common/anim';
import { services } from '../../services';
import { RecordCelebration } from '../fx/run/record-celebration';
import { leaveResultsAds, type RunExit } from '../economy/interstitial-flow';
import { isLiveRun } from '../run/results-data';
import { SCENES, type ResultsData } from '../app/scene-keys';
import { fadeInResultsDim } from '../run/results-launch';
import { createDimOverlay } from '../ui/common/dim-overlay';
import { enterScreen, leaveScreen, type Movable } from '../ui/common/transition';
import { bindResultsBack, ResultsButtons } from '../ui/menu/results/results-buttons';
import { ResultsCoins } from '../ui/menu/results/results-coins';
import { createResultsParts, resultsLinesFor } from '../ui/menu/results/results-build';
import { ResultsHeader } from '../ui/menu/results/results-header';
import type { ResultsLines } from '../ui/menu/results/results-lines';
import { isCompactHeader, panelRoom, placeResults } from '../ui/menu/results/results-model';
import { createResultsStart } from '../ui/menu/results/results-start';
import { shareResult } from '../ui/menu/results/results-share';
import { ResultsMissions } from '../ui/menu/results/results-missions';
import { ResultsPanel, type PanelParts } from '../ui/menu/results/results-panel';
import { resultsFlow } from '../ui/menu/results/results-flow';
import { presentedCreatures } from '../ui/menu/results/results-text';
import type { ResultsXp } from '../ui/menu/results/results-xp';
import { askForRatingOnResults } from '../ui/menu/results/results-rating';
import { cueMusic } from '../audio/music-cues';
import { safeBand } from '../app/safe-area';
import { frameOf, safeFrame } from '../ui/common/safe-frame';

/**
 * The end of a run: height, stats, coins, XP and the way on (docs/07-ui-screens.md, section 6).
 * A run that holds the screen (`ResultsData.hold`) builds it hidden, one piece per frame, while the
 * tower collapses; `reveal` shows it when it is time (docs/08-architecture.md, section 12).
 */
export class ResultsScene extends Phaser.Scene {
  private run!: ResultsData;
  private dim!: Phaser.GameObjects.Rectangle;
  /** The frames below the header. */
  private panel!: ResultsPanel;
  private header!: ResultsHeader;
  private coins!: ResultsCoins;
  private missions!: ResultsMissions;
  /** Null for a run that did not reach the save (no XP). */
  private xp: ResultsXp | null = null;
  private buttons!: ResultsButtons;
  private lines!: ResultsLines;
  private parts!: PanelParts;
  /** The pieces are built and placed. */
  private built = false;
  private celebration: RecordCelebration | null = null;
  /** The pieces of the screen still to build, one per frame while it is hidden. */
  private steps: Array<() => void> = [];
  /** The screen is on show (not hidden while it builds). */
  private shown = false;
  /** `reveal` was called: the screen shows as soon as it is built. */
  private revealWanted = false;
  /** The HUD camera faded out on show; kept, because the HUD may shut down before this scene. */
  private hudCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  private leaving = false;
  /** The share picture is being made: another tap waits for it. */
  private sharing = false;
  /** What the interstitial rules need to know about the run on screen. */
  private runExit: RunExit = {
    runMs: 0,
    recorded: false,
    newRecord: false,
    levelUp: false,
    newCreature: false,
  };

  constructor() {
    super(SCENES.results);
  }

  create(data: ResultsData): void {
    this.run = data;
    this.leaving = false;
    this.sharing = false;
    this.shown = false;
    this.built = false;
    this.celebration = null;
    this.xp = null;
    this.steps = [
      () => this.buildTop(),
      () => this.buildBlocks(),
      () => this.buildButtons(),
      () => this.buildPanel(),
    ];
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    bindResultsBack(this, () => this.buttons as ResultsButtons | undefined);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.revealWanted = false;
      this.hudCamera?.setAlpha(1);
      this.hudCamera = null;
    });
    if (data.hold) {
      this.sys.setVisible(false);
      this.input.enabled = false;
    } else {
      this.revealWanted = true;
      this.show();
    }
  }

  /** The screen may appear: at once when it is built, else as soon as it is. */
  reveal(): void {
    this.revealWanted = true;
  }

  override update(_time: number, delta: number): void {
    if (!this.shown) {
      this.steps.shift()?.();
      if (this.revealWanted) this.show();
      return;
    }
    this.header.update(delta);
    this.coins.update(delta);
    this.xp?.update(delta);
    this.missions.update(delta);
    this.celebration?.update(delta);
  }

  /** The dim veil and the header with the lines under the height. */
  private buildTop(): void {
    const { width, height } = this.scale.gameSize;
    // The veil covers the canvas, the insets too: it ignores the scroll by the top inset.
    this.dim = createDimOverlay(this, ANIM.results.overlayAlpha, width, height)
      .setInteractive()
      .setScrollFactor(0);
    this.lines = resultsLinesFor(this.run);
    const compact = isCompactHeader(safeFrame(height).height);
    this.header = new ResultsHeader(this, this.run.result, this.lines.header, compact);
  }

  /** The tiles, the level row, the reward rows, the team and the missions. */
  private buildBlocks(): void {
    this.parts = createResultsParts(this, this.run, this.lines);
    this.coins = this.parts.coins;
    this.missions = this.parts.missions;
    this.xp = this.parts.xp;
  }

  /** The buttons and the way on: what each of them does. */
  private buildButtons(): void {
    const { summary, result } = this.run;
    const live = isLiveRun(this.run);
    // The creatures the levels handed out are presented before anything else.
    const fresh = presentedCreatures(summary);
    this.runExit = {
      runMs: result.durationMs,
      recorded: live,
      newRecord: summary.isRecord,
      levelUp: summary.levelUps.length > 0,
      newCreature: fresh.length > 0,
    };
    const flow = resultsFlow({
      scene: this,
      summary,
      daily: result.mode === 'daily',
      fresh,
      leave: (then) => this.leave(then),
    });
    // Runs that do not reach the save (bot, start height) and the tutorial run have nothing to share.
    const handlers =
      live && !summary.firstRun
        ? { ...flow.handlers, share: () => this.share(this.run) }
        : flow.handlers;
    const start = createResultsStart(this, this.run, this.header, {
      start: flow.start,
      leaving: () => this.leaving,
      busy: (on) => {
        if (!this.leaving) this.lock(on);
      },
    });
    this.buttons = new ResultsButtons(this, summary.firstRun, handlers, flow.labels, start);
    this.lock(true);
  }

  /** The frames with their rows, fitted to the screen, and everything put in place. */
  private buildPanel(): void {
    // The frames go under the header and the buttons; the record ribbon, made last, draws over all of them.
    this.panel = new ResultsPanel(this, this.parts, this.header.container);
    const frame = safeFrame(this.scale.gameSize.height).height;
    this.panel.fit(panelRoom(frame, this.header.height, this.buttons.height));
    if (this.run.summary.isRecord) this.celebration = new RecordCelebration(this);
    this.built = true;
    this.layout();
  }

  /** Builds what is left, then lets the screen in: the veil fades, the content slides, the XP fills. */
  private show(): void {
    for (let step = this.steps.shift(); step; step = this.steps.shift()) step();
    this.shown = true;
    this.revealWanted = false;
    this.sys.setVisible(true);
    this.input.enabled = true;
    const { width, height } = this.scale.gameSize;
    // A new record has its own track; without one the zone's track goes on.
    cueMusic({ kind: 'results', record: this.run.summary.isRecord });
    if (this.run.summary.isRecord) this.celebrate(width, safeFrame(height).height);
    if (import.meta.env.DEV) {
      this.input.keyboard?.on('keydown-R', () => this.celebrate(width, safeFrame(height).height));
    }
    // The run HUD (height, wobble bar, next creature) fades out: the results tell the story now.
    this.hudCamera = this.scene.get(SCENES.hud).cameras.main;
    // The ads may have loaded while the screen was built hidden.
    this.coins.refreshAd();
    this.buttons.refreshAd();
    fadeInResultsDim(this, this.dim);
    this.tweens.add({ targets: this.hudCamera, alpha: 0, duration: ANIM.results.fadeMs });
    enterScreen(this, this.content(), () => {
      // The buttons wake up once the screen is in, so taps made during the run cannot hit them.
      this.coins.setEnabled(true);
      // Play again and Home wait for the XP fill and every level-up window.
      this.missions.start();
      const xpDone = (): void => {
        if (!this.leaving) this.buttons.setEnabled(true);
        // After every animation of the results: the system may ask for a rating.
        askForRatingOnResults(this, {
          exit: this.runExit,
          daily: this.run.result.mode === 'daily',
          busy: () => this.leaving || this.sharing,
          ad: {
            showing: () => this.coins.adShowing,
            onceClosed: (callback) => this.coins.onceAdClosed(callback),
          },
        });
      };
      if (this.xp) this.xp.start(xpDone);
      else xpDone();
    });
  }

  /** What slides in and out with the screen, top to bottom; the dim veil stays. */
  private content(): Movable[] {
    return [this.header.container, ...this.panel.content(), this.buttons.container];
  }

  /** Confetti, the ribbon, the fanfare and the three-hit vibration of a new record. */
  private celebrate(width: number, height: number): void {
    this.celebration ??= new RecordCelebration(this);
    this.celebration.play(width, height, safeBand().top);
    services.audio.record();
    services.haptics.play('triple');
  }

  /** Buttons stand at the bottom; the header and the panel above them share the free room evenly. */
  private layout(): void {
    if (!this.built) return;
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    const band = safeBand();
    this.cameras.main.setScroll(0, -band.top);
    this.dim.setSize(width, height);
    const places = placeResults(
      frameOf(height, band).height,
      this.header.height,
      this.panel.height,
      this.buttons.height,
    );
    const cx = width / 2;
    this.header.container.setPosition(cx, places.headerY);
    this.panel.setTop(cx, places.panelTop);
    this.buttons.container.setPosition(cx, places.buttonsY);
  }

  /** Every way out and the doubling answer no taps (while a start is paid for, while leaving). */
  private lock(on: boolean): void {
    this.buttons.setEnabled(!on);
    this.coins.setEnabled(!on);
  }

  /** Makes the picture of the tower and shares it; taps during the making are ignored. */
  private share(data: ResultsData): void {
    if (this.sharing || this.leaving) return;
    this.sharing = true;
    void shareResult(this, data).finally(() => {
      this.sharing = false;
    });
  }

  /**
   * The ads that are due are shown over the results (the interstitial, then the "No ads" offer),
   * then the screen slides away and darkens and `then` takes over. Buttons stop answering.
   */
  private leave(then: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    this.xp?.stop();
    this.lock(true);
    const slideAway = (): void => leaveScreen(this, this.content(), then);
    void leaveResultsAds(this.runExit).then(slideAway, slideAway);
  }
}
