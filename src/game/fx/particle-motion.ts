import { DEG_TO_RAD, MS_PER_SECOND, pickRange, sineWave, TWO_PI } from '../../util/math';

/** Inclusive `[min, max]` range a value is picked from. */
export type Range = readonly [number, number];

/** Random source in 0..1; tests inject a fixed one. */
export type RandomFn = () => number;

/** Data-driven look and motion of one kind of particle (numbers live in ANIM). */
export interface ParticleStyle {
  /** Start speed, pixels per second. */
  speed: Range;
  /** Downward acceleration, pixels per second squared. */
  gravity: number;
  /** Share of the velocity lost per second (exponential). */
  drag: number;
  /** Rotation speed, degrees per second. */
  spin: Range;
  /** Start scale. */
  scale: Range;
  /** End scale as a multiplier of the start scale. */
  scaleTo: number;
  /** Start alpha; it stays after `holdShare` of the life, then fades to 0. */
  alpha: number;
  holdShare: number;
  lifeMs: Range;
  /** Width of the cone the directions are spread over, degrees. */
  spreadDeg: number;
  /** Edge and line bursts lift the outward direction up by this angle, degrees. */
  tiltDeg: number;
  /** The texture is a long shape: its axis follows the start direction. */
  alignToDirection?: boolean;
  /** Horizontal flutter, e.g. for confetti. */
  sway?: { amplitude: Range; periodMs: Range };
}

/** State of one particle. Angles in degrees, speeds in pixels per second. */
export interface ParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  spin: number;
  angle: number;
  scaleFrom: number;
  scaleTo: number;
  alpha: number;
  holdShare: number;
  lifeMs: number;
  swayAmplitude: number;
  swayPeriodMs: number;
  swayPhase: number;
}

/** What the renderer shows for a particle of a given age. */
export interface ParticleView {
  x: number;
  y: number;
  angle: number;
  scale: number;
  alpha: number;
}

const FULL_TURN_DEG = 360;
const QUARTER_TURN_DEG = 90;
const HALF_TURN_DEG = 180;

/** Moves a particle forward by `dtMs`: gravity, drag, then position and rotation. */
export function stepParticle(p: ParticleState, dtMs: number): void {
  const dt = dtMs / MS_PER_SECOND;
  const keep = Math.exp(-p.drag * dt);
  p.vy += p.gravity * dt;
  p.vx *= keep;
  p.vy *= keep;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.angle += p.spin * dt;
}

/** Position, rotation, scale and alpha of a particle that is `ageMs` old. */
export function viewParticle(p: ParticleState, ageMs: number): ParticleView {
  const progress = Math.min(1, Math.max(0, ageMs / p.lifeMs));
  const fadeSpan = 1 - p.holdShare;
  const fade = fadeSpan > 0 ? Math.max(0, (progress - p.holdShare) / fadeSpan) : 0;
  const sway =
    p.swayAmplitude === 0 ? 0 : p.swayAmplitude * sineWave(ageMs, p.swayPeriodMs, p.swayPhase);
  return {
    x: p.x + sway,
    y: p.y,
    angle: p.angle,
    scale: p.scaleFrom + (p.scaleFrom * p.scaleTo - p.scaleFrom) * progress,
    alpha: p.alpha * (1 - fade),
  };
}

/** One particle at (x, y) flying in `directionDeg` (0 is right, 90 is down) with a random spread. */
function makeParticle(
  x: number,
  y: number,
  directionDeg: number,
  style: ParticleStyle,
  random: RandomFn,
): ParticleState {
  const heading = directionDeg + (random() - 0.5) * style.spreadDeg;
  const speed = pickRange(style.speed, random);
  const sway = style.sway;
  return {
    x,
    y,
    vx: Math.cos(heading * DEG_TO_RAD) * speed,
    vy: Math.sin(heading * DEG_TO_RAD) * speed,
    gravity: style.gravity,
    drag: style.drag,
    spin: pickRange(style.spin, random),
    angle: style.alignToDirection ? heading + QUARTER_TURN_DEG : random() * FULL_TURN_DEG,
    scaleFrom: pickRange(style.scale, random),
    scaleTo: style.scaleTo,
    alpha: style.alpha,
    holdShare: style.holdShare,
    lifeMs: pickRange(style.lifeMs, random),
    swayAmplitude: sway ? pickRange(sway.amplitude, random) : 0,
    swayPeriodMs: sway ? pickRange(sway.periodMs, random) : 1,
    swayPhase: sway ? random() * TWO_PI : 0,
  };
}

/** Direction of the outward-and-up flight from a side (1 right, -1 left). */
function outwardDeg(side: 1 | -1, tiltDeg: number): number {
  return (side === 1 ? 0 : HALF_TURN_DEG) - side * tiltDeg;
}

/** `count` particles from one point in a cone around `directionDeg`; a 360 spread is a radial burst. */
export function coneBurst(
  x: number,
  y: number,
  directionDeg: number,
  count: number,
  style: ParticleStyle,
  random: RandomFn = Math.random,
): ParticleState[] {
  return Array.from({ length: count }, () => makeParticle(x, y, directionDeg, style, random));
}

/**
 * `count` particles split between the left and right edges of a layer centred on
 * (centerX, centerY); each side flies outwards and slightly up.
 */
export function edgeBurst(
  centerX: number,
  centerY: number,
  width: number,
  count: number,
  style: ParticleStyle,
  random: RandomFn = Math.random,
): ParticleState[] {
  const result: ParticleState[] = [];
  const sides = [-1, 1] as const;
  sides.forEach((side, i) => {
    const share = Math.floor(count / 2) + (i === 0 ? count % 2 : 0);
    result.push(
      ...coneBurst(
        centerX + (side * width) / 2,
        centerY,
        outwardDeg(side, style.tiltDeg),
        share,
        style,
        random,
      ),
    );
  });
  return result;
}

/** `count` particles spread along a vertical cut line of `height` around (x, centerY), flying towards `side`. */
export function lineBurst(
  x: number,
  centerY: number,
  height: number,
  side: 1 | -1,
  count: number,
  style: ParticleStyle,
  random: RandomFn = Math.random,
): ParticleState[] {
  const direction = outwardDeg(side, style.tiltDeg);
  return Array.from({ length: count }, () =>
    makeParticle(x, centerY + (random() - 0.5) * height, direction, style, random),
  );
}

/**
 * Confetti falling over a `width` wide screen: spread across the width and
 * stacked above the top edge up to `spawnDepth` (a share of `height`) so they arrive in a stream.
 */
export function confettiRain(
  width: number,
  height: number,
  spawnDepth: number,
  count: number,
  style: ParticleStyle,
  random: RandomFn = Math.random,
): ParticleState[] {
  return Array.from({ length: count }, () =>
    makeParticle(
      random() * width,
      -random() * spawnDepth * height,
      QUARTER_TURN_DEG,
      style,
      random,
    ),
  );
}
