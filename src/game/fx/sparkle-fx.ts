import { TREASURE } from '../../data/treasure-anim';
import { DEPTH } from '../depth';
import { FX_TEXTURES } from './fx-textures';
import { coneBurst, type ParticleStyle } from './particle-motion';
import type { Particles } from './particles';

const SPARKLE_TINTS = TREASURE.colors.sparkle;

/** One star that swells and fades where it is, at the world point (x, y). */
export function twinkle(particles: Particles, x: number, y: number): void {
  particles.emit(1, (n) => coneBurst(x, y, 0, n, TREASURE.twinkle), {
    texture: FX_TEXTURES.star,
    tints: SPARKLE_TINTS,
    depth: DEPTH.particles,
  });
}

/** A burst of stars from the world point (x, y), flying in a cone around `directionDeg`. */
export function starBurst(
  particles: Particles,
  x: number,
  y: number,
  count: number,
  directionDeg: number,
  style: ParticleStyle,
  tints: readonly number[] = SPARKLE_TINTS,
): void {
  particles.emit(count, (n) => coneBurst(x, y, directionDeg, n, style), {
    texture: FX_TEXTURES.star,
    tints,
    depth: DEPTH.particles,
  });
}
