import { IDLE_CHANNEL_LAG, type IdleSpec } from '../../data/idle-motion';
import { sineWave } from '../../util/math';

/** What an idle sway makes of an object this frame. Scales are multipliers (1 = rest). */
export interface IdlePose {
  scaleX: number;
  scaleY: number;
  /** Degrees. */
  angle: number;
  /** Vertical offset, logical pixels. */
  bob: number;
}

/**
 * The quiet sway of an object at `timeMs`: scale, tilt and bob as sines of one period. `phase`
 * (radians) offsets the whole sway. `out` is refilled and returned, so a frame allocates nothing.
 */
export function idlePose(
  spec: IdleSpec,
  timeMs: number,
  phase = 0,
  out: IdlePose = { scaleX: 1, scaleY: 1, angle: 0, bob: 0 },
): IdlePose {
  out.scaleX = 1 + spec.scaleX * sineWave(timeMs, spec.periodMs, phase);
  out.scaleY = 1 + spec.scaleY * sineWave(timeMs, spec.periodMs, phase + IDLE_CHANNEL_LAG.scaleY);
  out.angle = spec.angleDeg * sineWave(timeMs, spec.periodMs, phase + IDLE_CHANNEL_LAG.angle);
  out.bob = spec.bobPx * sineWave(timeMs, spec.periodMs, phase + IDLE_CHANNEL_LAG.bob);
  return out;
}

/** The parts of a display object an idle pose drives. */
interface Swayable {
  setScale(x: number, y: number): unknown;
  setAngle(degrees: number): unknown;
}

/** Applies the scale and tilt of a pose to an object (the bob is the caller's to place). */
export function applyIdlePose(target: Swayable, pose: Readonly<IdlePose>): void {
  target.setScale(pose.scaleX, pose.scaleY);
  target.setAngle(pose.angle);
}
