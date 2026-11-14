import * as Phaser from 'phaser';
import { nearMiss } from '../../core/near-miss';
import { ANIM } from '../../data/anim';
import type { CreatureId } from '../../data/creatures';
import { MENU } from '../../data/menu-layout';
import { PALETTE } from '../../data/palette';
import { services } from '../../services';
import { gameState } from '../../state';
import { RecordCelebration } from '../fx/record-celebration';
import { SCENES, type ResultsData } from '../scene-keys';
import { createDimOverlay } from '../ui/dim-overlay';
import { createOutlinedText } from '../ui/outlined-text';
import { enterScreen, leaveScreen, type Movable } from '../ui/transition';
import { fitText } from '../ui/menu/fit-text';
import { ResultsButtons } from '../ui/menu/results-buttons';
import { ResultsCoins } from '../ui/menu/results-coins';
import { ResultsHeader, createStats } from '../ui/menu/results-header';
import { spreadBlocks } from '../ui/menu/results-layout';
import { ResultsMissions } from '../ui/menu/results-missions';
import { resultsFlow } from '../ui/menu/results-flow';
import { ResultsTiers } from '../ui/menu/results-tiers';
import { coinLines, dailyBestText, nearMissText, newCreaturesOf } from '../ui/menu/results-text';
import { ResultsXp } from '../ui/menu/results-xp';

const cfg = MENU.results;

type Block = Phaser.GameObjects.Container | Phaser.GameObjects.Text;

/** The end of a run: height, stats, coins, XP and the way on (docs/07-ui-screens.md, section 6). */
export class ResultsScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private header!: ResultsHeader;
  private stats!: ReturnType<typeof createStats>;
  private coins!: ResultsCoins;
  private xp!: ResultsXp;
  private tiers!: ResultsTiers;
  private missions!: ResultsMissions;
  private hint!: Phaser.GameObjects.Text;
  private buttons!: ResultsButtons;
  private celebration: RecordCelebration | null = null;
  private leaving = false;

  constructor() {
    super(SCENES.results);
  }

  create(data: ResultsData): void {
    const { result, summary, tally } = data;
    const daily = result.mode === 'daily';
    const { width, height } = this.scale.gameSize;
    this.leaving = false;
    this.dim = createDimOverlay(this, ANIM.results.overlayAlpha, width, height).setInteractive();
    this.header = new ResultsHeader(this, result, summary.isRecord);
    this.stats = createStats(this, result, tally.abilities, width);
    // The coins of a daily run are not doubled by an ad: that place is for the classic run only.
    this.coins = new ResultsCoins(this, result.coins, coinLines(tally), data.recorded && !daily);
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
    const hintText = daily
      ? dailyBestText(gameState.dailyInfo().best)
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
    this.hint = createOutlinedText(this, 0, 0, hintText, cfg.nearMissFont, PALETTE.gold);
    fitText(this.hint, cfg.nearMissWidth);

    // The creatures the levels handed out are presented before anything else.
    const levelCreatures = newCreaturesOf(summary.levelUps);
    const fresh: CreatureId[] = summary.firstRun
      ? ['honey', ...levelCreatures.filter((id) => id !== 'honey')]
      : levelCreatures;
    const flow = resultsFlow({
      scene: this,
      summary,
      daily,
      fresh,
      leave: (then) => this.leave(then),
    });
    this.buttons = new ResultsButtons(this, summary.firstRun, flow.handlers, flow.labels);
    this.buttons.setEnabled(false);
    this.coins.setEnabled(false);

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
    return [...this.blocks().map((b) => b.obj), this.buttons.container];
  }

  /** Confetti, the ribbon, the fanfare and the three-hit vibration of a new record. */
  private celebrate(width: number, height: number): void {
    this.celebration ??= new RecordCelebration(this);
    this.celebration.play(width, height);
    services.audio.record();
    services.haptics.play('triple');
  }

  /** The blocks above the buttons, top to bottom; empty ones are left out. */
  private blocks(): Array<{ obj: Block; height: number }> {
    const all: Array<{ obj: Block; height: number }> = [
      { obj: this.header.container, height: this.header.height },
      { obj: this.stats.obj, height: this.stats.height },
      { obj: this.coins.container, height: this.coins.height },
      { obj: this.tiers.container, height: this.tiers.height },
      { obj: this.xp.container, height: this.xp.height },
      { obj: this.missions.container, height: this.missions.height },
      { obj: this.hint, height: cfg.nearMissFont * cfg.lineHeight },
    ];
    return all.filter((b) => b.height > 0);
  }

  /** Buttons stand at the bottom; the blocks above them share the free room evenly. */
  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const cx = width / 2;
    this.cameras.main.setSize(width, height);
    this.dim.setSize(width, height);
    const blocks = this.blocks();
    const buttonsY = height - cfg.buttonsBottom - this.buttons.height / 2;
    const centres = spreadBlocks(
      blocks.map((b) => b.height),
      cfg.top,
      buttonsY - this.buttons.height / 2,
      cfg.sectionGap,
    );
    blocks.forEach((b, i) => {
      b.obj.setPosition(cx, centres[i]);
    });
    this.buttons.container.setPosition(cx, buttonsY);
    this.xp.layout(width, height);
  }

  /** The screen slides away and darkens, then `then` takes over. Buttons stop answering. */
  private leave(then: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    this.xp.stop();
    this.buttons.setEnabled(false);
    this.coins.setEnabled(false);
    leaveScreen(this, this.content(), then);
  }
}
