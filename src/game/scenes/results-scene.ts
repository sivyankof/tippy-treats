import * as Phaser from 'phaser';
import { nearMiss } from '../../core/near-miss';
import { ANIM } from '../../data/anim';
import { MENU } from '../../data/menu-layout';
import { PALETTE } from '../../data/palette';
import { services } from '../../services';
import { gameState } from '../../state';
import { RecordCelebration } from '../fx/record-celebration';
import { CLASSIC_RUN } from '../run-request';
import { launchRun, openScreen, SCENES, type ResultsData } from '../scene-keys';
import { createDimOverlay } from '../ui/dim-overlay';
import { createOutlinedText } from '../ui/outlined-text';
import { enterScreen, leaveScreen, type Movable } from '../ui/transition';
import { fitText } from '../ui/menu/fit-text';
import { ResultsButtons } from '../ui/menu/results-buttons';
import { ResultsCoins } from '../ui/menu/results-coins';
import { ResultsHeader, createStats } from '../ui/menu/results-header';
import { spreadBlocks } from '../ui/menu/results-layout';
import { coinLines, nearMissText, newCreaturesOf } from '../ui/menu/results-text';
import { ResultsXp } from '../ui/menu/results-xp';

const cfg = MENU.results;

/** The end of a run: height, stats, coins, XP and the way on (docs/07-ui-screens.md, section 6). */
export class ResultsScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private header!: ResultsHeader;
  private stats!: ReturnType<typeof createStats>;
  private coins!: ResultsCoins;
  private xp!: ResultsXp;
  private hint!: Phaser.GameObjects.Text;
  private buttons!: ResultsButtons;
  private celebration: RecordCelebration | null = null;
  private leaving = false;

  constructor() {
    super(SCENES.results);
  }

  create(data: ResultsData): void {
    const { result, summary, tally } = data;
    const { width, height } = this.scale.gameSize;
    this.leaving = false;
    this.dim = createDimOverlay(this, ANIM.results.overlayAlpha, width, height).setInteractive();
    this.header = new ResultsHeader(this, result, summary.isRecord);
    this.stats = createStats(this, result, tally.abilities, width);
    this.coins = new ResultsCoins(this, result.coins, coinLines(tally), data.recorded);
    this.xp = new ResultsXp(this, summary, {
      level: gameState.data.bakerLevel,
      xp: gameState.data.bakerXp,
    });
    const miss = nearMiss({
      height: result.height,
      previousRecord: summary.previousRecord,
      bakerLevel: gameState.data.bakerLevel,
      bakerXp: gameState.data.bakerXp,
      coins: gameState.coins,
      owned: gameState.data.creatures,
    });
    this.hint = createOutlinedText(this, 0, 0, nearMissText(miss), cfg.nearMissFont, PALETTE.gold);
    fitText(this.hint, cfg.nearMissWidth);

    // The creatures the levels handed out are presented before anything else.
    const levelCreatures = newCreaturesOf(summary.levelUps);
    const fresh = summary.firstRun
      ? ['honey', ...levelCreatures.filter((id) => id !== 'honey')]
      : levelCreatures;
    this.buttons = new ResultsButtons(this, summary.firstRun, {
      primary: () =>
        summary.firstRun
          ? this.leave(() => {
              gameState.markHint('firstResults');
              openScreen(this, SCENES.newCreature, {
                creatures: fresh,
                then: { kind: 'screen', key: SCENES.home },
                firstHome: true,
              });
            })
          : this.leave(() =>
              fresh.length > 0
                ? openScreen(this, SCENES.newCreature, {
                    creatures: [...fresh],
                    then: { kind: 'run', request: CLASSIC_RUN },
                  })
                : this.playAgain(),
            ),
      home: () =>
        this.leave(() =>
          fresh.length > 0
            ? openScreen(this, SCENES.newCreature, {
                creatures: [...fresh],
                then: { kind: 'screen', key: SCENES.home },
              })
            : openScreen(this, SCENES.home),
        ),
    });
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
      this.xp.start(() => {
        if (!this.leaving) this.buttons.setEnabled(true);
      });
    });
  }

  override update(_time: number, delta: number): void {
    this.header.update(delta);
    this.coins.update(delta);
    this.xp.update(delta);
    this.celebration?.update(delta);
  }

  /** What slides in and out with the screen, top to bottom; the dim veil stays. */
  private content(): Movable[] {
    return [
      this.header.container,
      this.stats.obj,
      this.coins.container,
      this.xp.container,
      this.hint,
      this.buttons.container,
    ];
  }

  /** Confetti, the ribbon, the fanfare and the three-hit vibration of a new record. */
  private celebrate(width: number, height: number): void {
    this.celebration ??= new RecordCelebration(this);
    this.celebration.play(width, height);
    services.audio.record();
    services.haptics.play('triple');
  }

  /** Buttons stand at the bottom; the blocks above them share the free room evenly. */
  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const cx = width / 2;
    this.cameras.main.setSize(width, height);
    this.dim.setSize(width, height);
    const hintHeight = cfg.nearMissFont * cfg.lineHeight;
    const blocks: Array<{
      obj: Phaser.GameObjects.Container | Phaser.GameObjects.Text;
      height: number;
    }> = [
      { obj: this.header.container, height: this.header.height },
      { obj: this.stats.obj, height: this.stats.height },
      { obj: this.coins.container, height: this.coins.height },
      { obj: this.xp.container, height: this.xp.height },
      { obj: this.hint, height: hintHeight },
    ];
    const buttonsY = height - cfg.buttonsBottom - this.buttons.height / 2;
    const heights = blocks.map((b) => b.height);
    heights.push(cfg.missionsHeight);
    const centres = spreadBlocks(
      heights,
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

  /** The new run drops in. */
  private playAgain(): void {
    launchRun(this);
    this.scene.stop();
  }
}
