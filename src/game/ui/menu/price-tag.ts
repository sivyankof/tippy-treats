import * as Phaser from 'phaser';
import type { Currency } from '../../../core/economy';
import { PALETTE } from '../../../data/palette';
import { formatNumber } from '../../../i18n';
import { TREASURE_TEXTURES, createTreasureTextures } from '../../fx/treasure-textures';
import { createOutlinedText } from '../outlined-text';

/** Icon size and the gap before it, relative to the font size. */
const ICON_SCALE = 1.1;
const GAP_SCALE = 0.2;

/**
 * A text followed by a coin or berry icon ("Buy for 300 ●"), centred on (x, y). The text may
 * hold `{price}`, which is filled in with the price; the icon goes right after the text.
 */
export class PriceTag extends Phaser.GameObjects.Container {
  private readonly label: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly fontSize: number,
    color: number = PALETTE.textLight,
  ) {
    super(scene, x, y);
    createTreasureTextures(scene);
    this.label = createOutlinedText(scene, 0, 0, '', fontSize, color);
    this.icon = scene.add.image(0, 0, TREASURE_TEXTURES.coin);
    this.add([this.label, this.icon]);
    scene.add.existing(this);
  }

  /** Shows `text` with the price filled in and the icon of `currency` after it. */
  show(text: string, price: number, currency: Currency): this {
    this.label.setText(text.replace('{price}', formatNumber(price)));
    this.icon
      .setTexture(currency === 'coins' ? TREASURE_TEXTURES.coin : TREASURE_TEXTURES.berry)
      .setDisplaySize(this.fontSize * ICON_SCALE, this.fontSize * ICON_SCALE);
    const gap = this.fontSize * GAP_SCALE;
    const total = this.label.width + gap + this.icon.displayWidth;
    this.label.setX(-total / 2 + this.label.width / 2);
    this.icon.setX(total / 2 - this.icon.displayWidth / 2);
    return this;
  }

  /** Width of text and icon together. */
  get contentWidth(): number {
    return this.label.width + this.fontSize * GAP_SCALE + this.icon.displayWidth;
  }
}
