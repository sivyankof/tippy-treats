import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { TREASURE } from '../../../data/treasure-anim';
import { gameState } from '../../../state';
import { TREASURE_TEXTURES } from '../../fx/treasure-textures';
import type { Button } from '../button';
import { ResourceCounter } from '../resource-tally';
import { TitleRibbon } from '../style/title-ribbon';
import { VolumePlate } from '../style/volume';
import { createIconButton } from './icon-button';

const { backSize, margin } = MENU.header;
const ribbon = MENU.style.ribbon;
const wallet = MENU.style.wallet;
const iconHalf = TREASURE.counter.iconSize / 2;

/** A wallet counter on its plate; the plate sits inside the counter, so it breathes with it. */
class WalletRow {
  readonly counter: ResourceCounter;
  private readonly plate: VolumePlate;
  private reach = -1;

  /** How far the plate of the wallet reaches left of the counter's anchor. */
  get plateReach(): number {
    return Math.max(this.reach, 0) + wallet.padLeft;
  }

  constructor(scene: Phaser.Scene, texture: string, row: number, sway: boolean) {
    this.counter = new ResourceCounter(scene, { texture, row, hiddenUntilFirst: false, sway });
    this.plate = new VolumePlate(scene, 'chip', wallet.height, { fill: wallet.fill });
    this.counter.root.addAt(this.plate, 0);
  }

  update(value: number, timeMs: number, dtMs: number): void {
    this.counter.update(value, timeMs, dtMs);
    const reach = this.counter.numberReach;
    if (reach === this.reach) return;
    this.reach = reach;
    const right = iconHalf + wallet.padRight;
    const left = -reach - wallet.padLeft;
    this.plate.setBodyWidth(right - left).setX((left + right) / 2);
  }
}

/**
 * The top of a menu screen: a back button on the left (none on Home), the title on a ribbon in
 * the middle (none when the title is empty), and the coin and berry counters on their plates
 * on the right.
 */
export class ScreenHeader {
  readonly back: Button | null;
  /** The title text on the ribbon; null when the screen has no title. */
  readonly title: Phaser.GameObjects.Text | null;
  readonly ribbon: TitleRibbon | null;
  private readonly coins: WalletRow;
  private readonly berries: WalletRow;
  private width = 0;
  private lastReach = -1;

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
    this.ribbon = title === '' ? null : new TitleRibbon(scene, 0, ribbon.y, title);
    this.title = this.ribbon?.label ?? null;
    this.coins = new WalletRow(scene, TREASURE_TEXTURES.coin, 0, false);
    this.berries = new WalletRow(scene, TREASURE_TEXTURES.berry, 1, true);
  }

  /** What slides in with the screen. */
  get parts(): Phaser.GameObjects.Container[] {
    const parts: Phaser.GameObjects.Container[] = [];
    if (this.back) parts.push(this.back);
    if (this.ribbon) parts.push(this.ribbon);
    parts.push(this.coins.counter.root, this.berries.counter.root);
    return parts;
  }

  layout(width: number): void {
    this.width = width;
    this.ribbon?.setX(width / 2);
    this.lastReach = -1;
    this.fitRibbon();
    this.coins.counter.layout(width);
    this.berries.counter.layout(width);
  }

  /** The counters roll to the wallet of the save. */
  update(timeMs: number, dtMs: number): void {
    this.coins.update(gameState.coins, timeMs, dtMs);
    this.berries.update(gameState.berries, timeMs, dtMs);
    this.fitRibbon();
  }

  /** The ribbon stays between the back button and the widest wallet plate. */
  private fitRibbon(): void {
    if (!this.ribbon || this.width === 0) return;
    const reach = Math.max(this.coins.plateReach, this.berries.plateReach);
    if (reach === this.lastReach) return;
    this.lastReach = reach;
    const left = (this.back ? margin + backSize : 0) + ribbon.walletGap;
    const right = this.width - TREASURE.counter.margin - iconHalf - reach - ribbon.walletGap;
    this.ribbon.setMaxWidth(right - left);
    const centre = this.width / 2;
    const half = this.ribbon.fullWidth / 2;
    this.ribbon.setX(Math.min(centre, right - half));
  }

  setBackEnabled(enabled: boolean): void {
    this.back?.setEnabled(enabled);
  }
}
