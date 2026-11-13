import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { PALETTE } from '../../data/palette';
import { formatNumber, t } from '../../i18n';
import { services } from '../../services';
import { RecordCelebration } from '../fx/record-celebration';
import { launchRun, SCENES, type ResultsData } from '../scene-keys';
import { createMenuButton, type Button } from '../ui/button';
import { createDimOverlay } from '../ui/dim-overlay';
import { sessionRecord } from '../session-record';
import { createOutlinedText } from '../ui/outlined-text';

const TITLE_FONT = 72;
const HEIGHT_FONT = 260;
const TITLE_OFFSET = -300;
const HEIGHT_OFFSET = -130;
const BUTTON_OFFSET = 190;

/** Temporary end screen: the result and a way back into a new run. */
export class ResultsScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private score!: Phaser.GameObjects.Text;
  private button!: Button;
  private celebration: RecordCelebration | null = null;

  constructor() {
    super(SCENES.results);
  }

  create(data: ResultsData): void {
    const { width, height } = this.scale.gameSize;
    this.dim = createDimOverlay(this, ANIM.results.overlayAlpha, width, height).setInteractive();
    this.title = createOutlinedText(this, 0, 0, t('run.gameOver'), TITLE_FONT);
    this.score = createOutlinedText(
      this,
      0,
      0,
      formatNumber(data.result.height),
      HEIGHT_FONT,
      PALETTE.gold,
    );
    // The button wakes up after the fade, so taps made during the run cannot restart it.
    this.button = createMenuButton(this, 0, 0, t('run.playAgain'), PALETTE.accent, () =>
      this.playAgain(),
    ).setEnabled(false);

    const root = this.add.container(0, 0, [this.dim, this.title, this.score, this.button]);
    root.setAlpha(0);
    this.tweens.add({
      targets: root,
      alpha: 1,
      duration: ANIM.results.fadeMs,
      onComplete: () => this.button.setEnabled(true),
    });

    this.celebration = null;
    if (sessionRecord.noteRun(data.result.height)) this.celebrate(width, height);
    if (import.meta.env.DEV) {
      this.input.keyboard?.on('keydown-R', () => this.celebrate(width, height));
    }

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();
  }

  override update(_time: number, delta: number): void {
    this.celebration?.update(delta);
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

  private playAgain(): void {
    launchRun(this);
    this.scene.stop();
  }
}
