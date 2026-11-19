import * as Phaser from 'phaser';
import type { Rng } from '../../../core/common/rng';
import { TOWER_SPARKLES } from '../../../data/tower/tower-sparkles';
import { DEG_TO_RAD, backOut, clamp01, lerp } from '../../../util/math';
import { DEPTH } from '../../depth';
import { sparkle } from '../../objects/backdrop/common/art-kit';
import { bakeTexture } from '../../ui/common/bake-texture';
import { hideItem, TimedPool, type PoolEntry } from '../common/timed-pool';
import { sparkleSpot, type SparkleField } from './tower-sparkle-spot';

const S = TOWER_SPARKLES;

interface Spark extends PoolEntry<Phaser.GameObjects.Image> {
  size: number;
  rotation: number;
  turn: number;
}

/** Bakes the one shared white sparkle picture. */
export function bakeTowerSparkle(scene: Phaser.Scene): void {
  const size = S.textureSize;
  bakeTexture(scene, S.texture, size, size, (g) => {
    sparkle(g, size / 2, size / 2, size / 2, 0xffffff);
  });
}

/**
 * Rare small sparkles beside the top of the tower: each pops in with a spring, turns a little
 * and fades. Rare at rest, more frequent for a short time after a perfect drop. A small pool of
 * images, one shared picture; nothing is redrawn per frame.
 */
export class TowerSparkles {
  private readonly pool: TimedPool<Phaser.GameObjects.Image, Spark>;
  private waitMs: number;
  private boostLeftMs = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly rng: Rng,
  ) {
    bakeTowerSparkle(scene);
    this.pool = new TimedPool(
      () => scene.add.image(0, 0, S.texture).setDepth(DEPTH.particles).setVisible(false),
      hideItem,
      S.maxLive,
    );
    this.waitMs = this.gap(S.restGapMs);
  }

  /** A perfect drop: a couple pop now and the pauses stay short for a while. */
  perfect(field: SparkleField): void {
    this.boostLeftMs = S.boostMs;
    for (let i = 0; i < S.perfectBurst; i++) this.spawn(field);
  }

  /**
   * Per frame. `field` is the tower as it is now; `on` is false in "Fewer effects" and when the
   * run is over: then none start and the live ones finish on their own.
   */
  update(dtMs: number, field: SparkleField, on: boolean): void {
    if (on) {
      this.boostLeftMs = Math.max(0, this.boostLeftMs - dtMs);
      this.waitMs -= dtMs;
      if (this.waitMs <= 0) {
        this.spawn(field);
        this.waitMs = this.gap(this.boostLeftMs > 0 ? S.boostGapMs : S.restGapMs);
      }
    }
    if (this.pool.liveCount === 0) return;
    this.pool.update(dtMs, (entry, progress) => {
      const pop = backOut(clamp01(progress / S.popShare));
      const fade = clamp01((progress - S.fadeFrom) / (1 - S.fadeFrom));
      entry.item
        .setScale((entry.size / S.textureSize) * pop * (1 - S.fadeShrink * fade))
        .setAlpha(1 - fade)
        .setRotation(entry.rotation + entry.turn * progress);
    });
  }

  private gap([min, max]: readonly [number, number]): number {
    return this.rng.range(min, max);
  }

  private spawn(field: SparkleField): void {
    let spot: { x: number; y: number } | null = null;
    for (let i = 0; i < S.tries && !spot; i++) {
      spot = sparkleSpot(field, [this.rng.next(), this.rng.next(), this.rng.next()]);
    }
    if (!spot) return;
    const sign = this.rng.chance(0.5) ? 1 : -1;
    const item = this.pool.take();
    item.setPosition(spot.x, spot.y).setScale(0).setAlpha(1).setVisible(true);
    this.pool.add({
      item,
      size: this.rng.range(S.sizePx[0], S.sizePx[1]),
      rotation: this.rng.range(-S.tilt, S.tilt) * DEG_TO_RAD,
      turn: sign * lerp(S.turnDeg[0], S.turnDeg[1], this.rng.next()) * DEG_TO_RAD,
      ageMs: 0,
      lifeMs: this.rng.range(S.lifeMs[0], S.lifeMs[1]),
    });
  }
}
