import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { gameState } from '../../../state';
import { TREASURE_TEXTURES } from '../../fx/treasure-textures';
import type { Button } from '../button';
import { createOutlinedText } from '../outlined-text';
import { ResourceCounter } from '../resource-tally';
import { createIconButton } from './icon-button';

const { backSize, margin, titleFont, titleY } = MENU.header;

/**
 * The top of a menu screen: a round back button on the left (none on Home), the title in
 * the middle, and the coin and berry counters of the wallet on the right.
 */
export class ScreenHeader {
  readonly back: Button | null;
  readonly title: Phaser.GameObjects.Text;
  private readonly coins: ResourceCounter;
  private readonly berries: ResourceCounter;

  constructor(scene: Phaser.Scene, title: string, onBack: (() => void) | null) {
    this.back = onBack
      ? createIconButton(
          scene,
          margin + backSize / 2,
          margin + backSize / 2,
          backSize,
          PALETTE.accentSecondary,
          'back',
          onBack,
        )
      : null;
    this.title = createOutlinedText(scene, 0, titleY, title, titleFont);
    this.coins = new ResourceCounter(scene, {
      texture: TREASURE_TEXTURES.coin,
      row: 0,
      hiddenUntilFirst: false,
    });
    this.berries = new ResourceCounter(scene, {
      texture: TREASURE_TEXTURES.berry,
      row: 1,
      hiddenUntilFirst: false,
      sway: true,
    });
  }

  /** What slides in with the screen. */
  get parts(): Array<Phaser.GameObjects.Container | Phaser.GameObjects.Text> {
    const parts: Array<Phaser.GameObjects.Container | Phaser.GameObjects.Text> = [
      this.title,
      this.coins.root,
      this.berries.root,
    ];
    if (this.back) parts.unshift(this.back);
    return parts;
  }

  layout(width: number): void {
    this.title.setX(width / 2);
    this.coins.layout(width);
    this.berries.layout(width);
  }

  /** The counters roll to the wallet of the save. */
  update(timeMs: number, dtMs: number): void {
    this.coins.update(gameState.coins, timeMs, dtMs);
    this.berries.update(gameState.berries, timeMs, dtMs);
  }

  setBackEnabled(enabled: boolean): void {
    this.back?.setEnabled(enabled);
  }
}
