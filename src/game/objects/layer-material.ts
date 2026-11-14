import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { creatureMaterial, type CreatureMaterial } from '../../data/creature-materials';
import type { CreatureId } from '../../data/creatures';
import { effectsMode } from '../effects-mode';
import { landSquash } from '../fx/anim-curves';
import { materialShape, type Shape } from './material-shape';

/** What the tower tells a layer about the frame: its clock, the sway and the layer's own phase. */
export interface MaterialMotion {
  timeMs: number;
  /** Sway amplitude as a share of the largest one, 0..1. */
  swayShare: number;
  phase: number;
}

/** A landing as the view plays it: where the squash starts, how long it takes to settle and how. */
export interface MaterialLanding {
  scaleX: number;
  scaleY: number;
  durationMs: number;
  ease: string;
}

/**
 * The material of a creature layer (docs/06, section 3, "Материал"): it shapes the landing and
 * moves `root`, a container pinned to the bottom edge of the layer, with the sway jiggle, the
 * quiet idle motion and the shiver after a landing. "Fewer effects" keeps only the landing.
 */
export class LayerMaterial {
  private material: CreatureMaterial | null = null;
  private shiverMs = 0;
  private readonly shape: Shape = { scaleX: 1, scaleY: 1 };

  constructor(private readonly root: Phaser.GameObjects.Container) {}

  /** The material of the layer, `null` for a plain layer. */
  get current(): CreatureMaterial | null {
    return this.material;
  }

  setCreature(creature: CreatureId | null): void {
    this.material = creature ? creatureMaterial(creature) : null;
    this.reset();
  }

  /** The landing (or the squash wave, `strength` below 1) of this material. */
  landing(strength: number): MaterialLanding {
    const land = this.material?.land;
    const squash = landSquash(strength * (land?.squash ?? 1));
    return {
      scaleX: squash.scaleX,
      scaleY: squash.scaleY,
      durationMs: ANIM.land.durationMs * (land?.durationMul ?? 1),
      ease: land?.ease ?? ANIM.land.ease,
    };
  }

  /** The shiver after its own landing starts. */
  startShiver(): void {
    this.shiverMs = this.material?.landShiver?.ms ?? 0;
  }

  /** Multiplier of the sway rotation. */
  get tilt(): number {
    if (effectsMode.reduced) return 1;
    return this.material?.sway?.tilt ?? 1;
  }

  /** Shapes the layer for this frame; without `motion` (a flying or falling layer) it stays still. */
  tick(dtMs: number, motion?: MaterialMotion): void {
    const material = this.material;
    if (!material) return;
    this.shiverMs = Math.max(0, this.shiverMs - dtMs);
    if (!motion || effectsMode.reduced) {
      this.root.setScale(1);
      return;
    }
    const shiverTotal = material.landShiver?.ms ?? 0;
    materialShape(
      material,
      {
        timeMs: motion.timeMs,
        swayShare: motion.swayShare,
        phase: motion.phase,
        shiverLeft: shiverTotal > 0 ? this.shiverMs / shiverTotal : 0,
      },
      this.shape,
    );
    this.root.setScale(this.shape.scaleX, this.shape.scaleY);
  }

  reset(): void {
    this.shiverMs = 0;
    this.root.setScale(1);
  }
}
