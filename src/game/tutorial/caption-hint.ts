import type * as Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { TUTORIAL_ANIM } from '../../data/tutorial-anim';
import { cssColor } from '../../util/color';
import { sineWave } from '../../util/math';
import { BarPlate } from '../ui/bar-plate';
import { FONT_FAMILY, FONT_WEIGHT } from '../ui/fonts';

const cfg = TUTORIAL_ANIM.caption;

/**
 * Text on a plate, readable on every backdrop. It is only a picture: taps go through it.
 * The owner decides when it shows (`render`) and where it sits (`place`).
 */
export class CaptionHint {
  private readonly root: Phaser.GameObjects.Container;
  private readonly plate: BarPlate;
  private readonly text: Phaser.GameObjects.Text;
  private phase: number;

  /** `phase` offsets the sway so two captions do not move in step. */
  constructor(scene: Phaser.Scene, phase = 0) {
    this.phase = phase;
    this.plate = new BarPlate(scene);
    this.text = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontStyle: FONT_WEIGHT.extraBold,
        fontSize: cfg.fontSize,
        color: cssColor(PALETTE.textDark),
        align: 'center',
        lineSpacing: cfg.lineSpacing,
        wordWrap: { width: cfg.width - cfg.padX * 2 },
      })
      .setOrigin(0.5);
    this.root = scene.add.container(0, 0, [this.plate.image, this.text]).setVisible(false);
  }

  setText(content: string): void {
    this.text.setText(content);
    const width = Math.min(cfg.width, this.text.width + cfg.padX * 2);
    this.plate.place(0, 0, width, this.text.height + cfg.padY * 2);
  }

  get height(): number {
    return this.text.height + cfg.padY * 2;
  }

  /** Centre of the plate. */
  place(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  /** Shows the caption at this opacity (0 hides it) with a quiet breath and tilt. */
  render(alpha: number, timeMs: number): void {
    const visible = alpha > 0;
    this.root.setVisible(visible);
    if (!visible) return;
    const wave = sineWave(timeMs, cfg.swayMs, this.phase);
    this.root
      .setAlpha(alpha * cfg.maxAlpha)
      .setAngle(cfg.swayDeg * wave)
      .setScale(1 + cfg.breathe * sineWave(timeMs, cfg.swayMs, this.phase + 1.4));
  }
}
