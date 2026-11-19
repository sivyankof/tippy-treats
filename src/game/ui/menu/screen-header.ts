import type * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { PALETTE } from '../../../data/common/palette';
import { TREASURE } from '../../../data/economy/treasure-anim';
import { gameState } from '../../../state';
import { TREASURE_TEXTURES } from '../../fx/economy/treasure-textures';
import type { Button } from '../common/button';
import type { Currency } from '../../../core/economy/economy';
import { shakeX } from '../common/shake-x';
import { TitleRibbon } from '../style/title-ribbon';
import { VolumePlate } from '../style/volume';
import { WalletChip } from '../style/wallet-chip';
import { createIconButton } from './icon-button';
import type { WalletTargets } from './reward-flight';

const { backSize, margin } = MENU.header;
const ribbon = MENU.style.ribbon;
const bandCfg = MENU.header.band;
const iconHalf = TREASURE.counter.iconSize / 2;

export interface ScreenHeaderOptions {
  /**
   * A plate behind the header: a list that scrolls under it (`ScrollList`) is hidden by it and
   * cannot be tapped through it.
   */
  band?: boolean;
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
  private readonly band: Phaser.GameObjects.Container | null;
  private readonly bandPlate: VolumePlate | null = null;
  private readonly bandShield: Phaser.GameObjects.Zone | null = null;
  private readonly coins: WalletChip;
  private readonly berries: WalletChip;
  private width = 0;
  private restX: Record<Currency, number> = { coins: 0, berries: 0 };
  private lastReach = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    title: string,
    onBack: (() => void) | null,
    options: ScreenHeaderOptions = {},
  ) {
    if (options.band) {
      this.bandPlate = new VolumePlate(scene, 'window', bandCfg.bottom + bandCfg.overhang);
      this.bandShield = scene.add.zone(0, 0, 1, bandCfg.bottom).setOrigin(0).setInteractive();
      this.band = scene.add.container(0, 0, [this.bandShield, this.bandPlate]);
    } else {
      this.band = null;
    }
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
    this.coins = new WalletChip(scene, {
      texture: TREASURE_TEXTURES.coin,
      row: 0,
      hiddenUntilFirst: false,
    });
    this.berries = new WalletChip(scene, {
      texture: TREASURE_TEXTURES.berry,
      row: 1,
      hiddenUntilFirst: false,
      sway: true,
    });
  }

  /** The two counters, where menu rewards fly to. */
  get wallet(): WalletTargets {
    return { coins: this.coins.counter, berries: this.berries.counter };
  }

  /** What slides in with the screen. */
  get parts(): Phaser.GameObjects.Container[] {
    const parts: Phaser.GameObjects.Container[] = [];
    if (this.band) parts.push(this.band);
    if (this.back) parts.push(this.back);
    if (this.ribbon) parts.push(this.ribbon);
    parts.push(this.coins.counter.root, this.berries.counter.root);
    return parts;
  }

  layout(width: number): void {
    this.width = width;
    this.bandPlate
      ?.setBodyWidth(width + bandCfg.overhang * 2)
      .setPosition(width / 2, (bandCfg.bottom - bandCfg.overhang) / 2);
    this.bandShield?.setSize(width, bandCfg.bottom);
    this.ribbon?.setX(width / 2);
    this.lastReach = -1;
    this.fitRibbon();
    this.coins.counter.layout(width);
    this.berries.counter.layout(width);
    this.restX = { coins: this.coins.counter.root.x, berries: this.berries.counter.root.x };
  }

  /** A tap could not pay: the counter of `currency` shakes. */
  refuse(currency: Currency): void {
    const chip = currency === 'coins' ? this.coins : this.berries;
    shakeX(this.scene, chip.counter.root, this.restX[currency]);
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
