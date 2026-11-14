import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { PALETTE } from '../../data/palette';
import { formatNumber, t } from '../../i18n';
import { services } from '../../services';
import { RecordCelebration } from '../fx/record-celebration';
import { launchRun, SCENES, type ResultsData } from '../scene-keys';
import { createMenuButton, type Button } from '../ui/button';
import { createDimOverlay } from '../ui/dim-overlay';
import { NumberRoll } from '../ui/number-roll';
import { createOutlinedText } from '../ui/outlined-text';
import { enterScreen, leaveScreen, type Movable } from '../ui/transition';

const TITLE_FONT = 72;
const HEIGHT_FONT = 260;
const TITLE_OFFSET = -300;
const HEIGHT_OFFSET = -130;
const BUTTON_OFFSET = 190;

/** Temporary end screen: the result rolls up from zero, and a way back into a new run. */
export class ResultsScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private score!: Phaser.GameObjects.Text;
  private button!: Button;
  private heightRoll = new NumberRoll();
  private celebration: RecordCelebration | null = null;

  constructor() {
    super(SCENES.results);
  }

  create(data: ResultsData): void {
    const { width, height } = this.scale.gameSize;
    this.dim = createDimOverlay(this, ANIM.results.overlayAlpha, width, height).setInteractive();
    this.title = createOutlinedText(this, 0, 0, t('run.gameOver'), TITLE_FONT);
    this.heightRoll = new NumberRoll();
    this.heightRoll.set(0);
    this.heightRoll.set(data.result.height);
    this.score = createOutlinedText(this, 0, 0, formatNumber(0), HEIGHT_FONT, PALETTE.gold);
    // The button wakes up once the screen is in, so taps made during the run cannot restart it.
    this.button = createMenuButton(this, 0, 0, t('run.playAgain'), PALETTE.accent, () =>
      this.playAgain(),
    )
      .setEnabled(false)
      .breathe();

    this.celebration = null;
    if (data.summary.isRecord) this.celebrate(width, height);
    if (import.meta.env.DEV) {
      this.input.keyboard?.on('keydown-R', () => this.celebrate(width, height));
    }

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();
    this.dim.setAlpha(0);
    this.tweens.add({ targets: this.dim, alpha: 1, duration: ANIM.results.fadeMs });
    enterScreen(this, this.content(), () => this.button.setEnabled(true));
  }

  override update(_time: number, delta: number): void {
    this.score.setText(formatNumber(this.heightRoll.update(delta)));
    this.celebration?.update(delta);
  }

  /** What slides in and out with the screen; the dim veil stays. */
  private content(): Movable[] {
    return [this.title, this.score, this.button];
  }

  /** Confetti, the ribbon, the fanfare and the three-hit vibration of a new record. */
  private celebrate(width: number, height: number): void {
    this.celebration ??= new RecordCelebration(this);
    this.celebration.play(width, height);
    services.audio.record();
    services.haptics.play('triple');
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const cx = width / 2;
    const cy = height / 2;
    this.cameras.main.setSize(width, height);
    this.dim.setSize(width, height);
    this.title.setPosition(cx, cy + TITLE_OFFSET);
    this.score.setPosition(cx, cy + HEIGHT_OFFSET);
    this.button.setPosition(cx, cy + BUTTON_OFFSET);
  }

  /** The screen slides away and darkens, then the new run drops in. */
  private playAgain(): void {
    this.button.setEnabled(false);
    leaveScreen(this, this.content(), () => {
      launchRun(this);
      this.scene.stop();
    });
  }
}
