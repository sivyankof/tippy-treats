import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { FloatText } from './float-text';
import { ParticleFx } from './particle-fx';
import { Particles } from './particles';
import { PerfectRing } from './perfect-ring';

const HALF_LAYER = BALANCE.layer.height / 2;

/** A layer that just landed, as the effects need it: world centre and width. */
export interface LandedLayer {
  x: number;
  y: number;
  width: number;
}

/** Particles, the perfect ring and the floating text of a run, driven by intention. */
export class LandingFx {
  readonly particles: Particles;
  private readonly particleFx: ParticleFx;
  readonly ring: PerfectRing;
  readonly text: FloatText;

  constructor(scene: Phaser.Scene) {
    this.particles = new Particles(scene);
    this.particleFx = new ParticleFx(this.particles);
    this.ring = new PerfectRing(scene);
    this.text = new FloatText(scene);
  }

  /** Dust from under both edges of every landing. */
  landed(layer: LandedLayer): void {
    this.particleFx.dust(layer.x, layer.y + HALF_LAYER, layer.width);
  }

  /** Crumbs along the cut edge; `side` is where the bitten part goes (1 right, -1 left). */
  bitten(cutX: number, centerY: number, side: 1 | -1, cakeColor: number): void {
    this.particleFx.crumbs(cutX, centerY, side, cakeColor);
  }

  /** Bits of the decorations fly off the cut line with the bitten-off part (none in "Fewer effects"). */
  decorBitten(cutX: number, centerY: number, height: number, side: 1 | -1, tints: number[]): void {
    this.particleFx.decorBits(cutX, centerY, height, side, tints);
  }

  /** Ring, sparks and "Perfect!" around a perfectly landed layer. */
  perfect(layer: LandedLayer, combo: number): void {
    this.ring.play(layer.x, layer.y, layer.width);
    this.particleFx.sparks(layer.x, layer.y, layer.width);
    this.text.showPerfect(layer.x, layer.y - HALF_LAYER - ANIM.perfect.text.liftY, combo);
  }

  /** Crumbs fly out of both sides of the top layer. */
  sneezed(layer: LandedLayer, cakeColor: number): void {
    this.particleFx.sneezeCrumbs(layer.x, layer.y, layer.width, cakeColor);
  }

  update(dtMs: number): void {
    this.particles.update(dtMs);
    this.ring.update(dtMs);
    this.text.update(dtMs);
  }
}
