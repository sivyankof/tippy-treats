import * as Phaser from 'phaser';
import { nearMiss } from '../../core/near-miss';
import { ANIM } from '../../data/anim';
import { MENU } from '../../data/menu-layout';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { services } from '../../services';
import { gameState } from '../../state';
import { RecordCelebration } from '../fx/record-celebration';
import { leaveResultsAds, type RunExit } from '../interstitial-flow';
import { isDebugRun, isLiveRun } from '../results-data';
import { SCENES, type ResultsData } from '../scene-keys';
import { createDimOverlay } from '../ui/dim-overlay';
import { createOutlinedText } from '../ui/outlined-text';
import { enterScreen, leaveScreen, type Movable } from '../ui/transition';
import { fitText } from '../ui/menu/fit-text';
import { createDebugPlate } from '../ui/menu/results-debug-plate';
import { ResultsButtons } from '../ui/menu/results-buttons';
import { ResultsCoins } from '../ui/menu/results-coins';
import { ResultsHeader, createStats } from '../ui/menu/results-header';
import { createResultsStart } from '../ui/menu/results-start';
import { startedLine } from '../ui/menu/results-start-model';
import { shareResult } from '../ui/menu/results-share';
import { spreadBlocks } from '../ui/menu/results-layout';
import { ResultsPanel } from '../ui/menu/results-panel';
import { ResultsMissions } from '../ui/menu/results-missions';
import { resultsFlow } from '../ui/menu/results-flow';
import { ResultsTiers } from '../ui/menu/results-tiers';
import { dailyResultsText } from '../ui/menu/daily-text';
import { coinLines, nearMissText, presentedCreatures } from '../ui/menu/results-text';
import { ResultsXp } from '../ui/menu/results-xp';

const cfg = MENU.results;

/** The end of a run: height, stats, coins, XP and the way on (docs/07-ui-screens.md, section 6). */
export class ResultsScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  /** The window plate of the kit with the blocks below the header. */
  private panel!: ResultsPanel;
  private header!: ResultsHeader;
  private stats!: ReturnType<typeof createStats>;
  private coins!: ResultsCoins;
  private xp!: ResultsXp;
  private tiers!: ResultsTiers;
  private missions!: ResultsMissions;
  private buttons!: ResultsButtons;
  private celebration: RecordCelebration | null = null;
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
    const { result, summary, tally } = data;
    const daily = result.mode === 'daily';
    const { width, height } = this.scale.gameSize;
    this.leaving = false;
    this.sharing = false;
    this.dim = createDimOverlay(this, ANIM.results.overlayAlpha, width, height).setInteractive();
    const started = data.checkpoint === null ? null : startedLine(data.startHeight, result.height);
    this.header = new ResultsHeader(
      this,
      result,
      summary.isRecord,
      started && t('results.startedAt', started),
    );
    this.stats = createStats(this, result, tally, width);
    // The coins of a daily run are not doubled by an ad: that place is for the classic run only.
    const live = isLiveRun(data);
    this.coins = new ResultsCoins(this, result.coins, coinLines(tally), live && !daily);
    this.tiers = new ResultsTiers(this, summary.dailyTiers);
    this.missions = new ResultsMissions(
      this,
      summary.missions.before,
      summary.missions.after,
      cfg.missions.maxRows,
    );
    this.xp = new ResultsXp(this, summary, {
      level: gameState.data.bakerLevel,
      xp: gameState.data.bakerXp,
    });
    // A run that is not saved gained no XP and set no record: the XP block and the hint stay out.
    const recorded = data.recorded;
    this.xp.container.setVisible(recorded);
    const debugPlate = isDebugRun(recorded, import.meta.env.DEV) ? createDebugPlate(this) : null;
    const hintText = daily
      ? dailyResultsText(result.height, gameState.dailyInfo().best, summary.dailyStale)
      : nearMissText(
          nearMiss({
            height: result.height,
            previousRecord: summary.previousRecord,
            bakerLevel: gameState.data.bakerLevel,
            bakerXp: gameState.data.bakerXp,
            coins: gameState.coins,
            owned: gameState.data.creatures,
            todayBest: gameState.todayBest,
            missions: summary.missions.after,
          }),
        );
    const hint = createOutlinedText(this, 0, 0, hintText, cfg.nearMissFont, PALETTE.gold);
    hint.setAlign('center');
    fitText(hint, cfg.nearMissWidth);
    hint.setVisible(recorded);
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
      daily,
      fresh,
      leave: (then) => this.leave(then),
    });
    // Runs that do not reach the save (bot, start height) and the tutorial run have nothing to share.
    const handlers =
      live && !summary.firstRun
        ? { ...flow.handlers, share: () => this.share(data) }
        : flow.handlers;
    const start = createResultsStart(this, data, this.header, {
      start: flow.start,
      leaving: () => this.leaving,
      busy: (on) => {
        if (!this.leaving) this.lock(on);
      },
    });
    this.buttons = new ResultsButtons(this, summary.firstRun, handlers, flow.labels, start);
    this.lock(true);
    this.panel = new ResultsPanel(this, {
      debugPlate,
      stats: this.stats,
      coins: this.coins,
      tiers: this.tiers,
      xp: this.xp,
      missions: this.missions,
      hint,
      recorded,
    });
    this.panel.fit(this.panelRoom(height), this.header.height);

    this.celebration = null;
    if (summary.isRecord) this.celebrate(width, height);
    if (import.meta.env.DEV) {
      this.input.keyboard?.on('keydown-R', () => this.celebrate(width, height));
    }

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    // The run HUD (height, wobble bar, next creature) fades out: the results tell the story now.
    const hudCamera = this.scene.get(SCENES.hud).cameras.main;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      hudCamera.setAlpha(1);
    });
    this.layout();
    this.dim.setAlpha(0);
    this.tweens.add({ targets: this.dim, alpha: 1, duration: ANIM.results.fadeMs });
    this.tweens.add({ targets: hudCamera, alpha: 0, duration: ANIM.results.fadeMs });
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

  override update(_time: number, delta: number): void {
    this.header.update(delta);
    this.coins.update(delta);
    this.xp.update(delta);
    this.missions.update(delta);
    this.celebration?.update(delta);
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

  /** Room for the header and the panel together: what the buttons leave, less a gap above and below the pair. */
  private panelRoom(screenHeight: number): number {
    return screenHeight - cfg.buttonsBottom - this.buttons.height - cfg.top - cfg.sectionGap * 2;
  }

  /** Buttons stand at the bottom; the header and the panel above them share the free room evenly. */
  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const cx = width / 2;
    this.cameras.main.setSize(width, height);
    this.dim.setSize(width, height);
    const buttonsY = height - cfg.buttonsBottom - this.buttons.height / 2;
    const [headerY = 0, panelY = 0] = spreadBlocks(
      [this.header.height, this.panel.height],
      cfg.top,
      buttonsY - this.buttons.height / 2,
      cfg.sectionGap,
    );
    this.header.container.setPosition(cx, headerY);
    this.panel.root.setPosition(cx, panelY);
    this.buttons.container.setPosition(cx, buttonsY);
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
