import {
  BACKDROP_LIFE,
  type HoverSpec,
  type Point,
  type PuffSpec,
  type TravelSpec,
  type TwinkleSpec,
} from '../../../data/backdrop-life';
import { mixColor } from '../../../util/color';
import {
  DEG_TO_RAD,
  GOLDEN,
  MS_PER_SECOND,
  oscillate01,
  sineWave,
  TWO_PI,
} from '../../../util/math';
import { edgeFade } from './pass-timer';

const WHITE = 0xffffff;
const MOTION = BACKDROP_LIFE.motion;

/** Where and how a picture is drawn; the object is reused for every call. */
export interface Pose {
  x: number;
  y: number;
  /** Radians. */
  rotation: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  /** `null` leaves the tint as it is. */
  tint: number | null;
}

export function newPose(): Pose {
  return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, tint: null };
}

function frac(value: number): number {
  return value - Math.floor(value);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Height factor of a blinking eyelid: 1 most of the time, `min` at the middle of the blink. */
export function blinkFactor(
  timeMs: number,
  blink: NonNullable<HoverSpec['blink']>,
  phase = 0,
): number {
  const t = frac(timeMs / blink.ms + phase / TWO_PI);
  const openUntil = 1 - blink.share;
  if (t < openUntil) return 1;
  const s = (t - openUntil) / blink.share;
  return 1 - (1 - blink.min) * (1 - Math.abs(2 * s - 1));
}

/** Pose of a hovering picture at `timeMs` on a `width` by `height` screen. */
export function hoverPose(
  spec: HoverSpec,
  width: number,
  height: number,
  timeMs: number,
  out: Pose,
): Pose {
  const phase = spec.phase ?? 0;
  const base = spec.scale ?? 1;
  let x = spec.at.x * width + (spec.offset?.x ?? 0);
  let y = spec.at.y * height + (spec.offset?.y ?? 0);
  let rotation = 0;
  let scaleX = base;
  let scaleY = base;
  let alpha = spec.alpha ?? 1;
  if (spec.swing) rotation += spec.swing.deg * sineWave(timeMs, spec.swing.ms, phase);
  if (spec.spin) rotation += (spec.spin * timeMs) / MS_PER_SECOND;
  if (spec.bob) y += spec.bob.px * sineWave(timeMs, spec.bob.ms, phase);
  if (spec.sway) x += spec.sway.px * sineWave(timeMs, spec.sway.ms, phase);
  if (spec.pulse) {
    const k = 1 + spec.pulse.amount * sineWave(timeMs, spec.pulse.ms, phase);
    scaleX *= k;
    scaleY *= k;
  }
  if (spec.flutter)
    scaleX *= 1 + spec.flutter.amount * sineWave(timeMs, spec.flutter.ms, phase * 2);
  if (spec.blink) scaleY *= blinkFactor(timeMs, spec.blink, phase);
  if (spec.orbit) {
    const angle = ((spec.orbit.degPerSec * timeMs) / MS_PER_SECOND) * DEG_TO_RAD + phase;
    const depth = 1 + spec.orbit.depth * Math.sin(angle);
    x += spec.orbit.rx * Math.cos(angle);
    y += spec.orbit.ry * Math.sin(angle);
    scaleX *= depth;
    scaleY *= depth;
  }
  if (spec.flicker) {
    alpha *= lerp(spec.flicker.lo, spec.flicker.hi, oscillate01(timeMs, spec.flicker.ms, phase));
  }
  out.x = x;
  out.y = y;
  out.rotation = rotation * DEG_TO_RAD;
  out.scaleX = scaleX;
  out.scaleY = scaleY;
  out.alpha = alpha;
  out.tint = spec.tintCycle
    ? mixColor(spec.tint ?? WHITE, spec.tintCycle.to, oscillate01(timeMs, spec.tintCycle.ms, phase))
    : null;
  return out;
}

/** Random choices of one pass: how far the path is shifted and which way it runs (1 right, -1 left). */
export interface TravelPass {
  shiftX: number;
  shiftY: number;
  direction: 1 | -1;
}

/** Pose of member `index` of a travelling flock, `progress` (0..1) of the way along its path. */
export function travelPose(
  spec: TravelSpec,
  pass: TravelPass,
  index: number,
  progress: number,
  width: number,
  height: number,
  timeMs: number,
  out: Pose,
): Pose {
  const flip = pass.direction < 0 && spec.bothWays;
  const fromX = flip ? 1 - spec.from.x : spec.from.x;
  const toX = flip ? 1 - spec.to.x : spec.to.x;
  const pathDx = (toX - fromX) * width;
  const pathDy = (spec.to.y - spec.from.y) * height;
  const side = index % 2 === 1 ? 1 : -1;
  const rank = Math.ceil(index / 2);
  let x = lerp(fromX, toX, progress) * width + pass.shiftX * width;
  let y = lerp(spec.from.y, spec.to.y, progress) * height + pass.shiftY * height;
  x -= Math.sign(pathDx) * rank * spec.spreadPx.x;
  y += side * rank * spec.spreadPx.y;
  const memberPhase = index * MOTION.flockPhase;
  if (spec.bob) y += spec.bob.px * sineWave(timeMs, spec.bob.ms, memberPhase);
  if (spec.wobble) {
    const angle = (TWO_PI * timeMs) / spec.wobble.ms + memberPhase;
    x += spec.wobble.px * MOTION.wobbleSide * Math.cos(angle);
    y += spec.wobble.px * Math.sin(angle);
  }
  let rotation = spec.alongPath ? Math.atan2(pathDy, pathDx) : 0;
  if (spec.rock)
    rotation += spec.rock.deg * DEG_TO_RAD * sineWave(timeMs, spec.rock.ms, memberPhase);
  out.x = x;
  out.y = y;
  out.rotation = rotation;
  out.scaleX = flip && !spec.alongPath ? -spec.scale : spec.scale;
  out.scaleY = spec.flap
    ? spec.scale * lerp(spec.flap.min, 1, oscillate01(timeMs, spec.flap.ms, memberPhase))
    : spec.scale;
  out.alpha = spec.alpha * edgeFade(progress, spec.fadeEdge);
  out.tint = null;
  return out;
}

/** Brightness of twinkle `index` at `timeMs`: 0..1. */
export function twinkleLevel(spec: TwinkleSpec, index: number, timeMs: number): number {
  const period = lerp(spec.periodMs[0], spec.periodMs[1], frac(index * GOLDEN));
  const phase = spec.alternate ? (index % 2) * Math.PI : index * MOTION.twinklePhase;
  return Math.pow(oscillate01(timeMs, period, phase), spec.sharpness);
}

/** Pose of twinkle `index`; `at` is the point in screen pixels. */
export function twinklePose(
  spec: TwinkleSpec,
  index: number,
  timeMs: number,
  at: Point,
  out: Pose,
): Pose {
  const level = twinkleLevel(spec, index, timeMs);
  out.x = at.x;
  out.y = at.y;
  out.rotation = 0;
  out.scaleX = lerp(spec.scale[0], spec.scale[1], level);
  out.scaleY = out.scaleX;
  out.alpha = lerp(spec.alpha[0], spec.alpha[1], level);
  out.tint = spec.tints.length > 0 ? (spec.tints[index % spec.tints.length] ?? null) : null;
  return out;
}

/** Pose of puff `index` of a rising column whose source is at (`originX`, `originY`). */
export function puffPose(
  spec: PuffSpec,
  index: number,
  timeMs: number,
  originX: number,
  originY: number,
  out: Pose,
): Pose {
  const age = frac(timeMs / spec.periodMs + index / spec.count);
  out.x =
    originX +
    spec.swayPx * age * Math.sin(age * TWO_PI * MOTION.puffSwayTurns + index * MOTION.puffSwayStep);
  out.y = originY - spec.riseHeight * age;
  out.rotation = 0;
  out.scaleX = lerp(spec.startScale, spec.endScale, age);
  out.scaleY = out.scaleX;
  out.alpha = spec.alpha * Math.sin(Math.PI * age);
  out.tint = null;
  return out;
}
