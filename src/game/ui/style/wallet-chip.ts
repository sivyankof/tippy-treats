import type * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { TREASURE } from '../../../data/economy/treasure-anim';
import { ResourceCounter, type CounterOptions } from '../economy/resource-tally';
import { VolumePlate } from './volume';

const wallet = MENU.style.wallet;
const iconHalf = TREASURE.counter.iconSize / 2;

export interface WalletChipOptions extends CounterOptions {
  /** In the run HUD the plate is see-through (`MENU.style.hud.alpha`). */
  hud?: boolean;
}

/**
 * A coin or berry counter of the style kit on its wallet plate: the menu headers and the run HUD
 * show the same thing. The plate sits inside the counter, so it breathes, hops and hides with it.
 * Call `update` every frame instead of the counter's own.
 */
export class WalletChip {
  readonly counter: ResourceCounter;
  private readonly plate: VolumePlate;
  private reach = -1;

  constructor(scene: Phaser.Scene, options: WalletChipOptions) {
    this.counter = new ResourceCounter(scene, options);
    this.plate = new VolumePlate(scene, 'chip', wallet.height, { fill: wallet.fill });
    if (options.hud) this.plate.setAlpha(MENU.style.hud.alpha);
    this.counter.root.addAt(this.plate, 0);
  }

  /** How far the plate reaches left of the counter's anchor (the icon centre). */
  get plateReach(): number {
    return Math.max(this.reach, 0) + wallet.padLeft;
  }

  /** Rolls the counter to `value` and stretches the plate under the number. */
  update(value: number, timeMs: number, dtMs: number): void {
    this.counter.update(value, timeMs, dtMs);
    this.fitPlate();
  }

  /** Shows `value` at once, without a roll. */
  snap(value: number): void {
    this.counter.snap(value);
    this.fitPlate();
  }

  private fitPlate(): void {
    const reach = this.counter.numberReach;
    if (reach === this.reach) return;
    this.reach = reach;
    const right = iconHalf + wallet.padRight;
    const left = -reach - wallet.padLeft;
    this.plate.setBodyWidth(right - left).setX((left + right) / 2);
  }
}
