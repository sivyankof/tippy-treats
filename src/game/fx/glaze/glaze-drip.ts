import * as Phaser from 'phaser';
import { ANIM } from '../../../data/common/anim';
import { BALANCE } from '../../../data/tower/balance';
import type { LayerView } from '../../objects/tower/layer-view';
import { rotatedOffset, squashedY } from '../cuts/cut-trace-place';
import { DEPTH } from '../../depth';
import { easeFn } from '../common/ease';
import { FX_TEXTURES } from '../common/fx-textures';
import { hideItem, TimedPool, type PoolEntry } from '../common/timed-pool';

const dripEase = easeFn(ANIM.bite.dripEase);

interface Drip extends PoolEntry<Phaser.GameObjects.Image> {
  startY: number;
  hold: DripHold | null;
}

/**
 * The layer a drop runs down: it rides the layer's sway and landing squash. `dx` is the drop's
 * offset from the layer centre and `up` its top's height above the layer's bottom edge, both as
 * the layer stands at rest.
 */
export interface DripHold {
  view: () => LayerView | null;
  dx: number;
  up: number;
}

const HALF_LAYER = BALANCE.layer.height / 2;

/** Pooled glaze drops that run down a bitten edge and fade. */
export class GlazeDrip {
  private readonly pool: TimedPool<Phaser.GameObjects.Image, Drip>;

  constructor(scene: Phaser.Scene) {
    this.pool = new TimedPool(
      () => scene.add.image(0, 0, FX_TEXTURES.drop).setOrigin(0.5, 0).setDepth(DEPTH.drips),
      hideItem,
    );
  }

  /** Starts a drop with its top at (x, y), tinted with the layer glaze colour; with `hold` it rides that layer. */
  spawn(x: number, y: number, color: number, hold: DripHold | null = null): void {
    const item = this.pool.take();
    item.setPosition(x, y).setTint(color).setAlpha(1).setVisible(true);
    const drip: Drip = { item, startY: y, hold, ageMs: 0, lifeMs: ANIM.bite.dripMs };
    this.pool.add(drip);
    // In place at once: a squashed layer never shows the drop above it, not even for a frame.
    this.place(drip, 0);
  }

  update(dtMs: number): void {
    this.pool.update(dtMs, (drip, progress) => this.place(drip, progress));
  }

  private place(drip: Drip, progress: number): void {
    const slide = ANIM.bite.dripSlide * dripEase(progress);
    const view = drip.hold?.view() ?? null;
    if (drip.hold && view) {
      const top = squashedY(view.y + HALF_LAYER, drip.hold.up, view.innerScaleY);
      // The offset from the layer centre turns with the layer, so the drop stays on its tilted glaze edge.
      const off = rotatedOffset(drip.hold.dx * view.innerScaleX, top - view.y, view.rotation);
      drip.item.setPosition(view.x + off.x, view.y + off.y + slide);
    } else {
      drip.item.setY(drip.startY + slide);
    }
    drip.item.setAlpha(1 - progress);
  }
}
