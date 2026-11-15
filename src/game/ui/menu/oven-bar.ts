import * as Phaser from 'phaser';
import { OVEN } from '../../../data/progression';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t } from '../../../i18n';
import { createOutlinedText } from '../outlined-text';
import { fitText } from './fit-text';
import { drawProgressBar } from './progress-bar';

const cfg = MENU.ovenBar;

/**
 * The "fresh oven" line: a thin bar of the fresh layers still left today and a short label
 * (docs/04-meta-retention.md, section 1). Centred on its origin; an empty bar says the bonus
 * comes back tomorrow, in words that carry no penalty.
 */
export class OvenBar extends Phaser.GameObjects.Container {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  /** What the bar shows now (the label says it all), so a repeat draws nothing. */
  private shown: string | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.bar = scene.add.graphics().setPosition(-cfg.width / 2 + cfg.barWidth / 2, 0);
    this.label = createOutlinedText(scene, cfg.width / 2, 0, '', cfg.font).setOrigin(1, 0.5);
    this.add([this.bar, this.label]);
    scene.add.existing(this);
  }

  /** `left` fresh layers are still to come today; the same picture again draws nothing, so it is cheap to call often. */
  show(left: number): this {
    const text = left > 0 ? t('oven.left', { n: formatNumber(left) }) : t('oven.empty');
    if (text === this.shown) return this;
    this.shown = text;
    drawProgressBar(
      this.bar,
      { width: cfg.barWidth, height: cfg.height, radius: cfg.radius, border: cfg.border },
      Math.min(1, left / OVEN.freshLayers),
      PALETTE.gold,
    );
    this.label.setText(text);
    fitText(this.label, cfg.width - cfg.barWidth - cfg.gap);
    return this;
  }
}
