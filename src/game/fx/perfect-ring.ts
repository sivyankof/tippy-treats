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

/** Colour, size and start delay of a ring; a perfect landing uses the defaults. */
export interface RingOptions {
  tint?: number;
  /** Multiplies the size of the ring. */
  scale?: number;
  delayMs?: number;
}

/** Pooled rings that spread from a landed layer and fade out. */
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
  play(x: number, y: number, layerWidth: number, options: RingOptions = {}): void {
    const { tint = PALETTE.textLight, scale = 1, delayMs = 0 } = options;
    const item = this.pool.take();
    const baseScaleX = (layerWidth * ring.widthRatio * scale) / RING_DIAMETER;
    const baseScaleY = (layerWidth * ring.heightRatio * scale) / RING_DIAMETER;
    item
      .setPosition(x, y)
      .setTint(tint)
      .setScale(baseScaleX * ring.fromScale, baseScaleY * ring.fromScale)
      .setAlpha(ring.fromAlpha)
      .setVisible(delayMs <= 0);
    this.pool.add({ item, baseScaleX, baseScaleY, ageMs: -delayMs, lifeMs: ring.durationMs });
  }

  update(dtMs: number): void {
    this.pool.update(dtMs, (entry, progress) => {
      if (progress < 0) return;
      entry.item.setVisible(true);
      const scale = ring.fromScale + (ring.toScale - ring.fromScale) * ringEase(progress);
      entry.item
        .setScale(entry.baseScaleX * scale, entry.baseScaleY * scale)
        .setAlpha(ring.fromAlpha * (1 - progress));
    });
  }
}
