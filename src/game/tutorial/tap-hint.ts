import * as Phaser from 'phaser';
import { HUD_LAYOUT } from '../../data/run/hud-layout';
import { TUTORIAL_ANIM } from '../../data/tutorial/tutorial-anim';
import { getLang, t } from '../../i18n';
import { effectsMode } from '../app/effects-mode';
import { fxGuard } from '../common/fx-guard';
import { oscillate01, sineWave } from '../../util/math';
import { FLYING_REACH } from '../run/camera-layout';
import { bakeGlyphLine } from '../ui/common/glyph-text';
import { tapGlyphStyle } from '../ui/run/run-volume-styles';
import { HAND, HAND_ORIGIN, HINT_TEXTURES, RAY_ORIGIN, tapLabelKey } from './hint-textures';
import { pressAgeMs, rayAngles, rayPose } from './tap-rays';

const tap = TUTORIAL_ANIM.tap;
const CAPTION_HUD_GAP = TUTORIAL_ANIM.caption.hudGap;
const rays = TUTORIAL_ANIM.rays;
const RAY_ANGLES = rayAngles(rays.count, rays.spreadDeg);

/**
 * A hand that taps and "Tap!" over the play area. It is only a picture: taps go through it
 * to the run.
 */
export class TapHint {
  private readonly hand: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Image;
  /** The rays of a press: made with the hint, only shown and moved afterwards. */
  private readonly rays: Phaser.GameObjects.Image[];
  private alpha = 0;
  private handY = 0;
  private screenWidth = 0;

  constructor(scene: Phaser.Scene) {
    // Baked here, when the hint is made in the current language, never during the run: one picture
    // of its own, as the Text was (its glyphs on the shared atlas would take a whole shelf).
    const text = t('tutorial.tap');
    const key = tapLabelKey(getLang());
    bakeGlyphLine(scene, tapGlyphStyle(text), text, key);
    this.label = scene.add.image(0, 0, key).setAlpha(0);
    this.hand = scene.add
      .image(0, 0, HINT_TEXTURES.hand)
      .setOrigin(HAND_ORIGIN[0], HAND_ORIGIN[1])
      .setAlpha(0);
    this.rays = RAY_ANGLES.map((angle) =>
      scene.add
        .image(0, 0, HINT_TEXTURES.ray)
        .setOrigin(RAY_ORIGIN[0], RAY_ORIGIN[1])
        .setRotation(angle)
        .setVisible(false),
    );
    this.setVisible(false);
  }

  layout(screenWidth: number): void {
    this.screenWidth = screenWidth;
  }

  /**
   * Puts the group above the flying row, which tops out `FLYING_REACH` over the tower top
   * (`towerTopY`, screen y), and never above the HUD.
   */
  private place(towerTopY: number): void {
    const flightTop = towerTopY - FLYING_REACH;
    const groupHeight = this.label.height + tap.textGap + HAND.height + tap.tapDistance;
    const top = Math.max(
      HUD_LAYOUT.bottomEdge + CAPTION_HUD_GAP,
      flightTop - tap.gapAboveFlight - groupHeight,
    );
    const y = top + this.label.height / 2;
    this.label.setPosition(this.screenWidth / 2, y);
    this.handY = y + this.label.height / 2 + tap.textGap;
    this.hand.setX(this.screenWidth / 2);
  }

  update(show: boolean, timeMs: number, deltaMs: number, towerTopY: number): void {
    const step = deltaMs / (show ? tap.fadeInMs : tap.fadeOutMs);
    this.alpha = Phaser.Math.Clamp(this.alpha + (show ? step : -step), 0, 1);
    const visible = this.alpha > 0;
    this.setVisible(visible);
    if (!visible) return;
    this.place(towerTopY);
    // The hand presses up into the text and back; at the press the finger squashes, the fingertip
    // staying on the touch point.
    const press = oscillate01(timeMs, tap.periodMs);
    this.hand
      .setAlpha(this.alpha)
      .setY(this.handY + tap.tapDistance * (1 - press))
      .setScale(1 + tap.squashX * press, 1 - tap.squashY * press);
    this.updateRays(timeMs);
    const breath = 1 + tap.textScale * sineWave(timeMs, tap.textPeriodMs);
    this.label.setAlpha(this.alpha).setScale(breath);
  }

  /** Gold rays fly out of the touch point after each press; none on minimal effects. */
  private updateRays(timeMs: number): void {
    if (effectsMode.reduced) {
      this.hideRays();
      return;
    }
    if (!fxGuard.call('tap-rays', this, this.placeRays, timeMs))
      fxGuard.cleanup('tap-rays', this, this.hideRays);
  }

  private placeRays(timeMs: number): void {
    const age = pressAgeMs(timeMs, tap.periodMs);
    const x = this.screenWidth / 2;
    const pose = rayPose(age, rays);
    this.rays.forEach((ray, i) => {
      if (!pose) {
        ray.setVisible(false);
        return;
      }
      const angle = RAY_ANGLES[i] ?? 0;
      ray
        .setVisible(true)
        .setPosition(x + Math.cos(angle) * pose.radius, this.handY + Math.sin(angle) * pose.radius)
        .setScale(pose.scale)
        .setAlpha(pose.alpha * this.alpha);
    });
  }

  private hideRays(): void {
    for (const ray of this.rays) ray.setVisible(false);
  }

  private setVisible(visible: boolean): void {
    this.hand.setVisible(visible);
    this.label.setVisible(visible);
    if (!visible) this.hideRays();
  }
}
