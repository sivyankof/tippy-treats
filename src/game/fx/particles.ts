import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { hideItem, TimedPool, type PoolEntry } from './timed-pool';
import { stepParticle, viewParticle, type ParticleState } from './particle-motion';

/** How a batch of particles is drawn. */
export interface ParticleLook {
  /** Texture key (see FX_TEXTURES). */
  texture: string;
  /** Tints handed out to the particles in turn. */
  tints: readonly number[];
  depth: number;
  /** 0 pins the particles to the screen (confetti); default is the world. */
  scrollFactor?: number;
}

interface LiveParticle extends PoolEntry<Phaser.GameObjects.Image> {
  state: ParticleState;
}

/**
 * Every small particle of a scene: one pool of images (capped at `ANIM.fx.particleLimit`,
 * the oldest is retired first) moved by `particle-motion`, not by Phaser's emitters.
 */
export class Particles {
  private readonly pool: TimedPool<Phaser.GameObjects.Image, LiveParticle>;

  constructor(scene: Phaser.Scene) {
    this.pool = new TimedPool(
      () => scene.add.image(0, 0, '').setVisible(false),
      hideItem,
      ANIM.fx.particleLimit,
    );
  }

  get liveCount(): number {
    return this.pool.liveCount;
  }

  /**
   * Emits `count` particles made by `generate(actualCount)`. The count is
   * the only knob that "fewer effects" turns, so all bursts go through here.
   */
  emit(count: number, generate: (count: number) => ParticleState[], look: ParticleLook): void {
    const states = generate(this.scaledCount(count));
    states.forEach((state, i) => {
      const image = this.pool.take();
      const view = viewParticle(state, 0);
      image
        .setTexture(look.texture)
        .setTint(look.tints[i % look.tints.length] ?? 0xffffff)
        .setDepth(look.depth)
        .setScrollFactor(look.scrollFactor ?? 1)
        .setPosition(view.x, view.y)
        .setAngle(view.angle)
        .setScale(view.scale)
        .setAlpha(view.alpha)
        .setVisible(true);
      this.pool.add({ item: image, state, ageMs: 0, lifeMs: state.lifeMs });
    });
  }

  /** Moves and draws every live particle. */
  update(dtMs: number): void {
    const dt = Math.min(dtMs, ANIM.fx.maxSimMs);
    this.pool.update(dt, (entry) => {
      stepParticle(entry.state, dt);
      const view = viewParticle(entry.state, entry.ageMs);
      entry.item
        .setPosition(view.x, view.y)
        .setAngle(view.angle)
        .setScale(view.scale)
        .setAlpha(view.alpha);
    });
  }

  /** Retires every live particle. */
  clear(): void {
    this.pool.clear();
  }

  /** The place for a "fewer effects" share to apply later; for now every burst runs in full. */
  private scaledCount(count: number): number {
    return count;
  }
}
