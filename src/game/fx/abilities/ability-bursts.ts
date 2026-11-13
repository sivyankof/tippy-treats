import { DEPTH } from '../../depth';
import { coneBurst, edgeBurst, type ParticleStyle } from '../particle-motion';
import type { Particles } from '../particles';

/** Particle bursts for the abilities; the counts go through `Particles.emit`, so "fewer effects" halves them. */
export class AbilityBursts {
  constructor(private readonly particles: Particles) {}

  /** A cone (or a full circle for a 360 spread) from one point. */
  cone(
    x: number,
    y: number,
    directionDeg: number,
    count: number,
    style: ParticleStyle,
    texture: string,
    tints: readonly number[],
  ): void {
    this.particles.emit(count, (n) => coneBurst(x, y, directionDeg, n, style), {
      texture,
      tints,
      depth: DEPTH.particles,
    });
  }

  /** Out of both side edges of a layer. */
  edges(
    centerX: number,
    centerY: number,
    width: number,
    count: number,
    style: ParticleStyle,
    texture: string,
    tints: readonly number[],
  ): void {
    this.particles.emit(count, (n) => edgeBurst(centerX, centerY, width, n, style), {
      texture,
      tints,
      depth: DEPTH.particles,
    });
  }
}
