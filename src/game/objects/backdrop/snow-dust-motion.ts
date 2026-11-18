import { TOWER_WEATHER } from '../../../data/tower-weather';
import { smoothstep } from '../../../util/math';

const DUST = TOWER_WEATHER.dust;

/** One flake of the dust: its place and speed (px, px per second; y grows downwards). */
export interface DustFlake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
}

/**
 * Launches a flake from a seam end: out to `side` (-1 left, 1 right) and up at `angleDeg` above the horizontal,
 * `speed` px per second.
 */
export function launchFlake(
  flake: DustFlake,
  x: number,
  y: number,
  side: -1 | 1,
  angleDeg: number,
  speed: number,
  lifeMs: number,
): DustFlake {
  const a = (angleDeg * Math.PI) / 180;
  flake.x = x;
  flake.y = y;
  flake.vx = side * Math.cos(a) * speed;
  flake.vy = -Math.sin(a) * speed;
  flake.ageMs = 0;
  flake.lifeMs = lifeMs;
  return flake;
}

/** Moves a flake on by `dtMs`: the air slows it down, then gravity settles it (it never speeds up sideways). */
export function stepFlake(flake: DustFlake, dtMs: number): void {
  const dt = dtMs / 1000;
  const keep = Math.exp(-DUST.drag * dt);
  flake.vx *= keep;
  flake.vy = flake.vy * keep + DUST.gravityPx * dt;
  flake.x += flake.vx * dt;
  flake.y += flake.vy * dt;
  flake.ageMs += dtMs;
}

/** Size of a flake over its life: it grows from nothing over `DUST.growMs`, then keeps its size. */
export function flakeGrow(ageMs: number): number {
  return smoothstep(Math.min(1, ageMs / DUST.growMs));
}

/** Opacity of a flake over its life: full, then fading over the last third. */
export function flakeAlpha(ageMs: number, lifeMs: number): number {
  const left = (lifeMs - ageMs) / (lifeMs / 3);
  return Math.max(0, Math.min(1, left));
}
