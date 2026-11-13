import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { DEPTH } from '../depth';
import { easeFn } from './ease';
import { FX_TEXTURES } from './fx-textures';
import { hideItem, TimedPool, type PoolEntry } from './timed-pool';

const dripEase = easeFn(ANIM.bite.dripEase);

interface Drip extends PoolEntry<Phaser.GameObjects.Image> {
  startY: number;
}

/** Pooled glaze drops that run down a bitten edge and fade. */
export class GlazeDrip {
  private readonly pool: TimedPool<Phaser.GameObjects.Image, Drip>;

  constructor(scene: Phaser.Scene) {
    this.pool = new TimedPool(
      () => scene.add.image(0, 0, FX_TEXTURES.drop).setOrigin(0.5, 0).setDepth(DEPTH.drips),
      hideItem,
    );
  }

  /** Starts a drop with its top at (x, y), tinted with the layer glaze colour. */
  spawn(x: number, y: number, color: number): void {
    const item = this.pool.take();
    item.setPosition(x, y).setTint(color).setAlpha(1).setVisible(true);
    this.pool.add({ item, startY: y, ageMs: 0, lifeMs: ANIM.bite.dripMs });
  }

  update(dtMs: number): void {
    this.pool.update(dtMs, (drip, progress) => {
      drip.item.setY(drip.startY + ANIM.bite.dripSlide * dripEase(progress)).setAlpha(1 - progress);
    });
  }
}
