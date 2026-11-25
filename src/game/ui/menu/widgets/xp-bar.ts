import * as Phaser from 'phaser';
import { xpToNext } from '../../../../core/progression/progression';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { formatNumber, t } from '../../../../i18n';
import { createOutlinedText } from '../../common/outlined-text';
import { drawProgressBar } from './progress-bar';

const { width, height, radius, font, labelGap, border, numbersScale } = MENU.xpBar;

/** How a bar other than the Home one looks: its height, the level font and the numbers inside it. */
export interface XpBarLook {
  barHeight: number;
  levelFont: number;
  /** The "120 / 165" numbers stand on the bar itself (else under it), in this font. */
  insideFont: number;
}

/**
 * Baker level and the XP bar: "Lv 6 [████░░] 120 / 165". `setProgress` takes a fractional
 * level (6.5 is halfway through level 6), so the bar can fill smoothly across a level-up.
 */
export class XpBar extends Phaser.GameObjects.Container {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly level: Phaser.GameObjects.Text;
  private readonly numbers: Phaser.GameObjects.Text;
  private readonly barHeight: number;

  /** `barWidth` is the length of the bar itself (`MENU.xpBar.width` when left out). */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly barWidth: number = width,
    look: XpBarLook | null = null,
  ) {
    super(scene, x, y);
    this.barHeight = look?.barHeight ?? height;
    this.bar = scene.add.graphics();
    this.level = createOutlinedText(
      scene,
      -barWidth / 2 - labelGap,
      0,
      '',
      look?.levelFont ?? font,
    ).setOrigin(1, 0.5);
    this.numbers = look
      ? createOutlinedText(scene, 0, 0, '', look.insideFont)
      : createOutlinedText(scene, 0, height + labelGap, '', font * numbersScale);
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
    drawProgressBar(
      this.bar,
      { width: this.barWidth, height: this.barHeight, radius, border },
      share,
      PALETTE.success,
    );
    return this;
  }
}
