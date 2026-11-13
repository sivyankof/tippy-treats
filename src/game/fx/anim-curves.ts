import { ANIM } from '../../data/anim';
import { REFERENCE_FRAME_MS } from '../../util/math';

/** Out-and-back curve: 0 at both ends of `t` in 0..1, 1 in the middle. */
export function bump(t: number): number {
  return Math.sin(Math.PI * t);
}

/** Motion of a flying piece, as the renderer integrates it. */
export interface PieceMotion {
  /** Velocity in pixels per second. */
  vx: number;
  vy: number;
  /** Rotation in degrees per second. */
  spin: number;
  gravity: number;
  lifeMs: number;
}

/** How a piece moves; `ANIM.bite` and `ANIM.miss` have this shape. */
export interface PieceStyle {
  spinDegPerSec: number;
  gravity: number;
  lifeMs: number;
  driftSpeed: number;
}

/** Motion of a piece that drifts sideways (`side`: -1 left, 1 right) and spins at a random sense. */
export function driftMotion(
  style: PieceStyle,
  side: -1 | 1,
  random: () => number = Math.random,
): PieceMotion {
  return {
    vx: side * style.driftSpeed,
    vy: 0,
    spin: (random() < 0.5 ? -1 : 1) * style.spinDegPerSec,
    gravity: style.gravity,
    lifeMs: style.lifeMs,
  };
}

/** Squash of the k-th layer below the landed one (k >= 1): scale and start delay. */
export function waveSquash(k: number): { scaleX: number; scaleY: number; delayMs: number } {
  const strength = Math.pow(ANIM.wave.falloff, k);
  return {
    scaleX: 1 + (ANIM.land.scaleX - 1) * strength,
    scaleY: 1 - (1 - ANIM.land.scaleY) * strength,
    delayMs: k * ANIM.wave.delayMs,
  };
}

/** Length of the tower collapse for a tower of `height` layers, clamped to the configured range. */
export function collapseDurationMs(height: number): number {
  const [minHeight, maxHeight] = ANIM.collapse.heightRange;
  const [minMs, maxMs] = ANIM.collapse.durationMs;
  const t = Math.min(1, Math.max(0, (height - minHeight) / (maxHeight - minHeight)));
  return minMs + (maxMs - minMs) * t;
}

/**
 * Start delay of the collapse of layer `index` (0 is the bottom) in a tower of `count`:
 * the top goes first, the bottom last, spread evenly so that the last piece
 * starts one step before `durationMs` and still has time to fall.
 */
export function collapseDelayMs(index: number, count: number, durationMs: number): number {
  if (count <= 1) return 0;
  const order = Math.min(count - 1, Math.max(0, count - 1 - index));
  return (order * durationMs) / count;
}

/** Position and velocity of a damped spring. */
export interface SpringState {
  value: number;
  velocity: number;
}

/** Spring steps run at the length of a 60 Hz frame so the result does not depend on the frame rate. */
const SPRING_STEP_MS = REFERENCE_FRAME_MS;

/**
 * Moves `state` towards `target` as a spring: `stiffness` pulls per 60 Hz step,
 * `damping` is the share of the velocity that survives a step (below 1 overshoots,
 * then settles).
 */
export function stepSpring(
  state: SpringState,
  target: number,
  stiffness: number,
  damping: number,
  deltaMs: number,
): void {
  let left = Math.min(Math.max(deltaMs, 0), ANIM.fx.maxSimMs);
  while (left > 0) {
    const k = Math.min(left, SPRING_STEP_MS) / SPRING_STEP_MS;
    state.velocity =
      (state.velocity + (target - state.value) * stiffness * k) * Math.pow(damping, k);
    state.value += state.velocity * k;
    left -= SPRING_STEP_MS;
  }
}
