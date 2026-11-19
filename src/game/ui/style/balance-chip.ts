import * as Phaser from 'phaser';
import type { Currency } from '../../../core/economy/economy';
import { MENU } from '../../../data/common/menu-layout';
import { TREASURE } from '../../../data/economy/treasure-anim';
import { TREASURE_TEXTURES } from '../../fx/economy/treasure-textures';
import { shakeX } from '../common/shake-x';
import { WalletChip } from './wallet-chip';

const iconHalf = TREASURE.counter.iconSize / 2;

/**
 * The player's balance of one currency inside a window where it is spent: a `WalletChip` of the
 * kit (the same counter as in the HUD and the menu headers), placed so that the right end of its
 * plate stands at `rightX` of the parent. It rolls to a new value, can snap to one and shakes
 * when a tap could not pay.
 */
export class BalanceChip {
  readonly chip: WalletChip;
  private readonly x: number;

  constructor(
    private readonly scene: Phaser.Scene,
    currency: Currency,
    rightX: number,
    y: number,
  ) {
    const berries = currency === 'berries';
    this.chip = new WalletChip(scene, {
      texture: berries ? TREASURE_TEXTURES.berry : TREASURE_TEXTURES.coin,
      row: berries ? 1 : 0,
      hiddenUntilFirst: false,
      sway: berries,
    });
    this.x = rightX - iconHalf - MENU.style.wallet.padRight;
    this.chip.counter.root.setPosition(this.x, y);
  }

  /** The object to add to the window. */
  get root(): Phaser.GameObjects.Container {
    return this.chip.counter.root;
  }

  /** Where the icon sits, in the parent's coordinates. */
  get position(): { x: number; y: number } {
    return { x: this.root.x, y: this.root.y };
  }

  /** Rolls the number to `value`; call every frame while the window shows. */
  update(value: number): void {
    this.chip.update(value, this.scene.time.now, this.scene.game.loop.delta);
  }

  /** Shows `value` at once. */
  snap(value: number): void {
    this.chip.snap(value);
  }

  /** The tap could not pay: the counter shakes. */
  shake(): void {
    shakeX(this.scene, this.root, this.x);
  }
}

/**
 * Keeps `chip` rolling to `value()` every frame while `owner` (the window that holds the chip)
 * is alive; stops by itself when the owner is destroyed or the scene shuts down.
 */
export function followBalance(
  scene: Phaser.Scene,
  chip: BalanceChip,
  owner: Phaser.GameObjects.GameObject,
  value: () => number,
): void {
  const stop = (): void => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, tick);
  };
  const tick = (): void => {
    // The window can be gone by the time the scene updates again (closed, or the scene left).
    if (!owner.active || !chip.root.active) {
      stop();
      return;
    }
    chip.update(value());
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  owner.once(Phaser.GameObjects.Events.DESTROY, stop);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
}
