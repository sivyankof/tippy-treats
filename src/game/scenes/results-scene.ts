import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { MENU } from '../../data/menu-layout';
import { t } from '../../i18n';
import { services } from '../../services';
import { gameState } from '../../state';
import { RecordCelebration } from '../fx/record-celebration';
import { leaveResultsAds, type RunExit } from '../interstitial-flow';
import { isDebugRun, isLiveRun } from '../results-data';
import { SCENES, type ResultsData } from '../scene-keys';
import { createDimOverlay } from '../ui/dim-overlay';
import { enterScreen, leaveScreen, type Movable } from '../ui/transition';
import { createDebugPlate } from '../ui/menu/results-debug-plate';
import { ResultsButtons } from '../ui/menu/results-buttons';
import { ResultsCoins } from '../ui/menu/results-coins';
import { ResultsHeader, createStats } from '../ui/menu/results-header';
import { createResultsHint } from '../ui/menu/results-hint';
import { createResultsStart } from '../ui/menu/results-start';
import { startedLine } from '../ui/menu/results-start-model';
import { shareResult } from '../ui/menu/results-share';
import { ResultsMissions } from '../ui/menu/results-missions';
import { ResultsPanel, type PanelParts } from '../ui/menu/results-panel';
import { resultsFlow } from '../ui/menu/results-flow';
import { ResultsTiers } from '../ui/menu/results-tiers';
import { coinLines, presentedCreatures } from '../ui/menu/results-text';
import { ResultsXp } from '../ui/menu/results-xp';

const cfg = MENU.results;

/**
 * The end of a run: height, stats, coins, XP and the way on (docs/07-ui-screens.md, section 6).
 * A run that holds the screen (`ResultsData.hold`) builds it hidden, one piece per frame, while the
 * tower collapses; `reveal` shows it when it is time (docs/08-architecture.md, section 12).
 */
export class ResultsScene extends Phaser.Scene {
  private run!: ResultsData;
  private dim!: Phaser.GameObjects.Rectangle;
  /** The window plate of the kit with the blocks below the header. */
  private panel!: ResultsPanel;
  private header!: ResultsHeader;
  private coins!: ResultsCoins;
  private missions!: ResultsMissions;
  private xp!: ResultsXp;
  private buttons!: ResultsButtons;
  private parts: Partial<PanelParts> = {};
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
    this.parts = {};
    this.steps = [
      () => this.buildTop(),
      () => this.buildBlocks(),
      () => this.buildFoot(),
      () => this.buildButtons(),
      () => this.buildPanel(),
    ];
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
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
    this.xp.update(delta);
    this.missions.update(delta);
    this.celebration?.update(delta);
  }

  /** The dim veil, the header and the stats. */
  private buildTop(): void {
    const { result, summary, tally } = this.run;
    const { width, height } = this.scale.gameSize;
    this.dim = createDimOverlay(this, ANIM.results.overlayAlpha, width, height).setInteractive();
    const started =
      this.run.checkpoint === null ? null : startedLine(this.run.startHeight, result.height);
    this.header = new ResultsHeader(
      this,
      result,
      summary.isRecord,
      started && t('results.startedAt', started),
    );
    this.parts.stats = createStats(this, result, tally, width);
  }

  /** The coins, the daily tiers and the missions. */
  private buildBlocks(): void {
    const { result, summary, tally } = this.run;
    // The coins of a daily run are not doubled by an ad: that place is for the classic run only.
    const canDouble = isLiveRun(this.run) && result.mode !== 'daily';
    this.coins = new ResultsCoins(this, result.coins, coinLines(tally), canDouble);
    this.parts.coins = this.coins;
    this.parts.tiers = new ResultsTiers(this, summary.dailyTiers);
    this.missions = new ResultsMissions(
      this,
      summary.missions.before,
      summary.missions.after,
      cfg.missions.maxRows,
    );
    this.parts.missions = this.missions;
  }

  /** The XP bar, the dev plate and the "so close" line. */
  private buildFoot(): void {
    const { recorded, summary } = this.run;
    this.xp = new ResultsXp(this, summary, {
      level: gameState.data.bakerLevel,
      xp: gameState.data.bakerXp,
    });
    // A run that is not saved gained no XP and set no record: the XP block and the hint stay out.
    this.xp.container.setVisible(recorded);
    this.parts.xp = this.xp;
    this.parts.recorded = recorded;
    this.parts.debugPlate = isDebugRun(recorded, import.meta.env.DEV)
      ? createDebugPlate(this)
      : null;
    this.parts.hint = createResultsHint(this, this.run);
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

  /** The plate with the blocks on it, fitted to the screen, and everything put in place. */
  private buildPanel(): void {
    // The plate and the blocks go under the header and the buttons; the record ribbon, made last,
    // draws over all of them.
    this.panel = new ResultsPanel(this, this.parts as PanelParts, this.header.container);
    this.panel.fit(this.scale.gameSize.height, this.header.height, this.buttons.height);
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
    if (this.run.summary.isRecord) this.celebrate(width, height);
    if (import.meta.env.DEV) {
      this.input.keyboard?.on('keydown-R', () => this.celebrate(width, height));
    }
    // The run HUD (height, wobble bar, next creature) fades out: the results tell the story now.
    this.hudCamera = this.scene.get(SCENES.hud).cameras.main;
    // The ads may have loaded while the screen was built hidden.
    this.coins.refreshAd();
    this.buttons.refreshAd();
    this.dim.setAlpha(0);
    this.tweens.add({ targets: this.dim, alpha: 1, duration: ANIM.results.fadeMs });
    this.tweens.add({ targets: this.hudCamera, alpha: 0, duration: ANIM.results.fadeMs });
    enterScreen(this, this.content(), () => {
      // The buttons wake up once the screen is in, so taps made during the run cannot hit them.
      this.coins.setEnabled(true);
      // Play again and Home wait for the XP fill and every level-up window.
      this.missions.start();
      this.xp.start(() => {
        if (!this.leaving) this.buttons.setEnabled(true);
      });
    });
  }

  /** What slides in and out with the screen, top to bottom; the dim veil stays. */
  private content(): Movable[] {
    return [this.header.container, ...this.panel.content(), this.buttons.container];
  }

  /** Confetti, the ribbon, the fanfare and the three-hit vibration of a new record. */
  private celebrate(width: number, height: number): void {
    this.celebration ??= new RecordCelebration(this);
    this.celebration.play(width, height);
    services.audio.record();
    services.haptics.play('triple');
  }

  /** Buttons stand at the bottom; the header and the panel above them share the free room evenly. */
  private layout(): void {
    if (!this.built) return;
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    this.dim.setSize(width, height);
    this.panel.layout(width, height, this.header, this.buttons);
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
    this.xp.stop();
    this.lock(true);
    const slideAway = (): void => leaveScreen(this, this.content(), then);
    void leaveResultsAds(this.runExit).then(slideAway, slideAway);
  }
}
