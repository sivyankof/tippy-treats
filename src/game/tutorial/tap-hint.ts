import * as Phaser from 'phaser';
import { TUTORIAL_ANIM } from '../../data/tutorial-anim';
import { t } from '../../i18n';
import { oscillate01, sineWave } from '../../util/math';
import { createOutlinedText } from '../ui/outlined-text';
import { HINT_TEXTURES } from './hint-textures';

const tap = TUTORIAL_ANIM.tap;

/**
 * A hand that taps and "Tap!" over the play area. It is only a picture: taps go through it
 * to the run.
 */
export class TapHint {
  private readonly hand: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private alpha = 0;
  private handY = 0;

  constructor(scene: Phaser.Scene) {
    this.label = createOutlinedText(scene, 0, 0, t('tutorial.tap'), tap.fontSize).setAlpha(0);
    this.hand = scene.add.image(0, 0, HINT_TEXTURES.hand).setOrigin(0.5, 0).setAlpha(0);
    this.setVisible(false);
  }

  layout(screenWidth: number, screenHeight: number): void {
    const y = screenHeight * tap.y;
    this.label.setPosition(screenWidth / 2, y);
    this.handY = y + this.label.height / 2 + tap.textGap;
    this.hand.setX(screenWidth / 2);
  }

  update(show: boolean, timeMs: number, deltaMs: number): void {
    const step = deltaMs / (show ? tap.fadeInMs : tap.fadeOutMs);
    this.alpha = Phaser.Math.Clamp(this.alpha + (show ? step : -step), 0, 1);
    const visible = this.alpha > 0;
    this.setVisible(visible);
    if (!visible) return;
    // The hand presses up into the text and back, and shrinks a little at the press.
    const press = oscillate01(timeMs, tap.periodMs);
    this.hand
      .setAlpha(this.alpha)
      .setY(this.handY + tap.tapDistance * (1 - press))
      .setScale(1 - tap.tapScale * press);
    const breath = 1 + tap.textScale * sineWave(timeMs, tap.textPeriodMs);
    this.label.setAlpha(this.alpha).setScale(breath);
  }

  private setVisible(visible: boolean): void {
    this.hand.setVisible(visible);
    this.label.setVisible(visible);
  }
}
