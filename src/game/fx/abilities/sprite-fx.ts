import * as Phaser from 'phaser';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { hideItem, TimedPool, type PoolEntry } from '../timed-pool';
import { sampleSprite, type SpriteFrame, type SpriteSpec } from './sprite-motion';

interface LiveSprite extends PoolEntry<Phaser.GameObjects.Image> {
  spec: SpriteSpec;
}

/**
 * Short-lived effect pictures (clouds, threads, crumbs in flight, rainbow stripes): one pool of
 * images, each moved along its `SpriteSpec`. The pool is capped; the oldest sprite goes first.
 */
export class SpriteFx {
  private readonly pool: TimedPool<Phaser.GameObjects.Image, LiveSprite>;
  /** Reused for every sprite of every frame. */
  private readonly frame: SpriteFrame = { x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, alpha: 1 };

  constructor(scene: Phaser.Scene) {
    this.pool = new TimedPool(
      () => scene.add.image(0, 0, '').setVisible(false),
      hideItem,
      ABILITY_ANIM.maxSprites,
    );
  }

  /** Starts a sprite; it appears after `spec.delayMs`. */
  spawn(spec: SpriteSpec): void {
    const item = this.pool.take();
    item
      .setTexture(spec.texture)
      .setOrigin(spec.originX, spec.originY)
      .setTint(spec.tint)
      .setDepth(spec.depth)
      .setScrollFactor(spec.screen ? 0 : 1)
      .setBlendMode(spec.additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setVisible(false);
    this.pool.add({ item, spec, ageMs: -spec.delayMs, lifeMs: spec.lifeMs });
  }

  update(dtMs: number): void {
    this.pool.update(dtMs, (entry, progress) => {
      if (progress < 0) return;
      const f = sampleSprite(entry.spec, progress, this.frame);
      entry.item
        .setPosition(f.x, f.y)
        .setScale(f.scaleX, f.scaleY)
        .setAngle(f.angle)
        .setAlpha(f.alpha)
        .setVisible(true);
    });
  }
}
