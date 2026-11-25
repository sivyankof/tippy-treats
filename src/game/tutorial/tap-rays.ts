import { DEG_TO_RAD } from '../../util/math';

/** What the rays of a press look like (`TUTORIAL_ANIM.rays`). */
export interface RaySpec {
  count: number;
  spreadDeg: number;
  startRadius: number;
  travel: number;
  lifeMs: number;
  fadeFrom: number;
  shrink: number;
}

/** Directions of the rays, radians: spread evenly over `spreadDeg` around straight up (-90 deg, y points down). */
export function rayAngles(count: number, spreadDeg: number): number[] {
  const up = -90;
  return Array.from({ length: count }, (_, i) => {
    const share = count > 1 ? i / (count - 1) - 0.5 : 0;
    return (up + share * spreadDeg) * DEG_TO_RAD;
  });
}

/**
 * Time since the last press of the hand, ms. The press is the top of `oscillate01(time, period)`,
 * a quarter period in.
 */
export function pressAgeMs(timeMs: number, periodMs: number): number {
  const age = (timeMs - periodMs / 4) % periodMs;
  return age < 0 ? age + periodMs : age;
}

export interface RayPose {
  /** Distance of the inner end of the ray from the touch point. */
  radius: number;
  alpha: number;
  /** Length scale of the ray. */
  scale: number;
}

/** The pose of a ray `ageMs` after the press; `null` once it is gone. */
export function rayPose(ageMs: number, spec: RaySpec): RayPose | null {
  if (ageMs < 0 || ageMs >= spec.lifeMs) return null;
  const life = ageMs / spec.lifeMs;
  const out = 1 - (1 - life) * (1 - life);
  const fade = life <= spec.fadeFrom ? 1 : 1 - (life - spec.fadeFrom) / (1 - spec.fadeFrom);
  return {
    radius: spec.startRadius + spec.travel * out,
    alpha: fade,
    scale: 1 - spec.shrink * life,
  };
}
