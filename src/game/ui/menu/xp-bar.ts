import * as Phaser from 'phaser';
import { xpToNext } from '../../../core/progression';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t } from '../../../i18n';
import { createOutlinedText } from '../outlined-text';

const { width, height, radius, font, labelGap, back, border, numbersScale } = MENU.xpBar;

/**
 * Baker level and the XP bar: "Lv 6 [████░░] 120 / 165". `setProgress` takes a fractional
 * level (6.5 is halfway through level 6), so the bar can fill smoothly across a level-up.
 */
export class XpBar extends Phaser.GameObjects.Container {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly level: Phaser.GameObjects.Text;
  private readonly numbers: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.bar = scene.add.graphics();
    this.level = createOutlinedText(scene, -width / 2 - labelGap, 0, '', font).setOrigin(1, 0.5);
    this.numbers = createOutlinedText(scene, 0, height + labelGap, '', font * numbersScale);
    this.add([this.bar, this.level, this.numbers]);
    scene.add.existing(this);
  }

  /** `level` and `xp` as the save holds them. */
  show(level: number, xp: number): this {
    return this.setProgress(level + xp / xpToNext(level));
  }

  /** A fractional level: the whole part is the level, the rest the share of the bar. */
  setProgress(progress: number): this {
    const level = Math.floor(progress);
    const share = progress - level;
    const need = xpToNext(level);
    this.level.setText(t('meta.levelShort', { n: level }));
    this.numbers.setText(`${formatNumber(Math.round(share * need))} / ${formatNumber(need)}`);
    const g = this.bar.clear();
    g.fillStyle(PALETTE.textDark, 1).fillRoundedRect(
      -width / 2 - border,
      -height / 2 - border,
      width + border * 2,
      height + border * 2,
      radius + border,
    );
    g.fillStyle(back, 1).fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    const fill = Math.max(0, Math.min(1, share)) * width;
    if (fill > 0) {
      g.fillStyle(PALETTE.success, 1).fillRoundedRect(
        -width / 2,
        -height / 2,
        Math.max(fill, radius * 2),
        height,
        radius,
      );
    }
    return this;
  }
}
