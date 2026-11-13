import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { PALETTE } from '../../data/palette';
import { DEPTH } from '../depth';
import { easeFn } from './ease';
import { FX_TEXTURES, RING_DIAMETER } from './fx-textures';
import { hideItem, TimedPool, type PoolEntry } from './timed-pool';

const ring = ANIM.perfect.ring;
const ringEase = easeFn(ring.ease);

interface Ring extends PoolEntry<Phaser.GameObjects.Image> {
  /** Scale that makes the ring as wide and as tall as the layer ratios ask, at animation scale 1. */
  baseScaleX: number;
  baseScaleY: number;
}

/** Pooled rings that spread from a perfectly landed layer and fade out. */
export class PerfectRing {
  private readonly pool: TimedPool<Phaser.GameObjects.Image, Ring>;

  constructor(scene: Phaser.Scene) {
    this.pool = new TimedPool(
      () =>
        scene.add
          .image(0, 0, FX_TEXTURES.ring)
          .setTint(PALETTE.textLight)
          .setDepth(DEPTH.ring)
          .setVisible(false),
      hideItem,
      ring.maxLive,
    );
  }

  /** Starts a ring around (x, y) for a layer of `layerWidth`. */
  play(x: number, y: number, layerWidth: number): void {
    const item = this.pool.take();
    const baseScaleX = (layerWidth * ring.widthRatio) / RING_DIAMETER;
    const baseScaleY = (layerWidth * ring.heightRatio) / RING_DIAMETER;
    item
      .setPosition(x, y)
      .setScale(baseScaleX * ring.fromScale, baseScaleY * ring.fromScale)
      .setAlpha(ring.fromAlpha)
      .setVisible(true);
    this.pool.add({ item, baseScaleX, baseScaleY, ageMs: 0, lifeMs: ring.durationMs });
  }

  update(dtMs: number): void {
    this.pool.update(dtMs, (entry, progress) => {
      const scale = ring.fromScale + (ring.toScale - ring.fromScale) * ringEase(progress);
      entry.item
        .setScale(entry.baseScaleX * scale, entry.baseScaleY * scale)
        .setAlpha(ring.fromAlpha * (1 - progress));
    });
  }
}
