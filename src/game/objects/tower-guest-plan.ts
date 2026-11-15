import { TOWER_GUEST } from '../../data/tower-guest';
import {
  DEG_TO_RAD,
  clamp01,
  easeOutQuad,
  lerp,
  pickRange,
  sineWave,
  TWO_PI,
} from '../../util/math';

const { splat } = TOWER_GUEST;

/** Where a visit is: coming in, resting, leaving, or the stages of a splat. */
export type GuestPhase =
  'away' | 'arrive' | 'sit' | 'leave' | 'squash' | 'hold' | 'peel' | 'shake' | 'flee';

/** Waits for the next visit; the numbers come from the cosmetic stream of the run. */
export class GuestScheduler {
  private waitMs: number;

  constructor(private readonly random: () => number) {
    this.waitMs = pickRange(TOWER_GUEST.firstDelayMs, random);
  }

  tick(dtMs: number): void {
    if (this.waitMs > 0) this.waitMs -= dtMs;
  }

  get ready(): boolean {
    return this.waitMs <= 0;
  }

  /** A visit started: the next one is a whole interval away. */
  started(): void {
    this.waitMs = pickRange(TOWER_GUEST.intervalMs, this.random);
  }

  /** The visit could not start: look again soon. */
  retry(): void {
    this.waitMs = TOWER_GUEST.retryMs;
  }
}

/** A span on the x axis. */
export interface Span {
  left: number;
  right: number;
}

/**
 * Where on a layer `width` wide, whose face takes `faceHalf` on each side of the centre, a guest
 * `halfBody` wide can sit: its offset from the centre, or `null` when there is no room beside the
 * face. `side` is -1 or 1, `reach` is 0..1 along the free stretch (0 is next to the face).
 * `avoid` (the shadow of the flying layer, as offsets from the centre) is kept clear when the
 * other choice allows it: the guest then sits as near the free end as the shadow leaves.
 */
export function siteOffset(
  width: number,
  faceHalf: number,
  halfBody: number,
  side: -1 | 1,
  reach: number,
  avoid: Span | null = null,
): number | null {
  const { faceGapPx, edgeGapPx, shadowGapPx } = TOWER_GUEST.site;
  const near = faceHalf + faceGapPx + halfBody;
  const far = width / 2 - edgeGapPx - halfBody;
  if (far < near) return null;
  const offset = side * lerp(near, far, clamp01(reach));
  if (!avoid) return offset;
  const clear = (x: number): boolean =>
    x + halfBody + shadowGapPx < avoid.left || x - halfBody - shadowGapPx > avoid.right;
  if (clear(offset)) return offset;
  const other = -offset;
  return clear(other) ? other : null;
}

/** A layer in the air is over the guest at `flyX` (its body, with the margin of `TOWER_GUEST.shy`). */
export function layerOverGuest(flyX: number, layerX: number, layerWidth: number): boolean {
  return Math.abs(flyX - layerX) < layerWidth / 2 + TOWER_GUEST.shy.marginPx;
}

/**
 * Whether the guest flinches now: a layer in the air has just come near it (`over` now, not before)
 * and the last flinch is over (`cooldownLeftMs` is 0 or less).
 */
export function shouldFlinch(over: boolean, wasOver: boolean, cooldownLeftMs: number): boolean {
  return over && !wasOver && cooldownLeftMs <= 0;
}

/**
 * The flinch `inMs` into it: how far the guest is lifted (pixels, up is positive) and how far it
 * leans (radians, positive is to the right) when `away` is 1 for a layer on the left and -1 on the
 * right. It goes up and settles back, so it is 0 at both ends.
 */
export function flinchPose(
  inMs: number,
  away: -1 | 1,
  out: { lift: number; lean: number },
): { lift: number; lean: number } {
  const { hopPx, hopMs, leanDeg } = TOWER_GUEST.shy;
  const arc = Math.sin(Math.PI * clamp01(inMs / hopMs));
  out.lift = hopPx * arc;
  out.lean = away * leanDeg * DEG_TO_RAD * arc;
  return out;
}

/**
 * Moves a guest at offset `dx` from the layer centre out of the face: at least `faceHalf` plus the
 * face gap plus `halfBody` away on its own side, and still on the layer (`width`).
 */
export function clearOfFace(dx: number, faceHalf: number, halfBody: number, width: number): number {
  const { faceGapPx, edgeGapPx } = TOWER_GUEST.site;
  const side = dx < 0 ? -1 : 1;
  const near = faceHalf + faceGapPx + halfBody;
  const far = Math.max(near, width / 2 - edgeGapPx - halfBody);
  return side * Math.min(Math.max(Math.abs(dx), near), far);
}

/** A layer of `width` at `layerX` covers a guest at `flyX`, so the guest would be under it. */
export function layerCovers(flyX: number, layerX: number, layerWidth: number): boolean {
  return Math.abs(flyX - layerX) < layerWidth / 2;
}

/** A point of a flight. */
export interface FlightPoint {
  x: number;
  y: number;
}

/**
 * Point `t` (0..1) of a flight from (`fromX`, `fromY`) to (`toX`, `toY`): a straight way with
 * sharp zigzag turns across it, `cycles` turns of `zigzagPx` that die out at both ends.
 * `ease` shapes the progress along the way. Fills and returns `out`.
 */
export function flightPoint(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  t: number,
  zigzagPx: number,
  cycles: number,
  ease: (t: number) => number,
  out: FlightPoint,
): FlightPoint {
  const p = ease(clamp01(t));
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy) || 1;
  // Triangle wave in -1..1, its envelope is 0 at both ends.
  const phase = (clamp01(t) * cycles) % 1;
  const tri = 1 - 4 * Math.abs(phase - 0.5);
  const envelope = Math.min(1, clamp01(t) * 4, (1 - clamp01(t)) * 4);
  const side = tri * envelope * zigzagPx;
  out.x = fromX + dx * p + (-dy / length) * side;
  out.y = fromY + dy * p + (dx / length) * side;
  return out;
}

/** Shape of the guest picture: which picture, its scales (1 is the normal size) and the tilt in radians. */
export interface GuestShape {
  /** The flat picture (a pancake with bulging eyes) instead of the normal one. */
  flat: boolean;
  scaleX: number;
  scaleY: number;
  tilt: number;
}

/**
 * The shape of the guest `inMs` into a stage of the splat: it squashes, the flat picture pops in
 * and gloops while held, narrows as the peel starts, then the normal picture swells back (tilted,
 * as if one end came off first) and shakes itself into shape. The shake ends exactly at the
 * normal shape. Fills and returns `out`.
 */
export function splatShape(phase: GuestPhase, inMs: number, out: GuestShape): GuestShape {
  out.flat = false;
  out.tilt = 0;
  out.scaleX = 1;
  out.scaleY = 1;
  const { gloop, peel, squashTo } = splat;
  switch (phase) {
    case 'squash': {
      const p = easeOutQuad(clamp01(inMs / splat.squashMs));
      out.scaleX = lerp(1, squashTo.scaleX, p);
      out.scaleY = lerp(1, squashTo.scaleY, p);
      return out;
    }
    case 'hold': {
      const kick = 1 + gloop.kick * Math.exp((-inMs * 3) / gloop.settleMs);
      const wave = gloop.amount * kick * sineWave(inMs, gloop.periodMs);
      out.flat = true;
      out.scaleX = 1 + wave;
      out.scaleY = 1 - wave;
      return out;
    }
    case 'peel': {
      const p = clamp01(inMs / splat.peelMs);
      out.tilt = -peel.tiltDeg * DEG_TO_RAD * Math.sin(Math.PI * p);
      if (p < 0.5) {
        out.flat = true;
        out.scaleX = lerp(1, peel.flatEnd.scaleX, p * 2);
        out.scaleY = lerp(1, peel.flatEnd.scaleY, p * 2);
      } else {
        out.scaleX = peel.scaleX;
        out.scaleY = peel.scaleY;
      }
      return out;
    }
    case 'shake': {
      const p = clamp01(inMs / splat.shakeMs);
      const { amount, cycles, decay, tiltDeg } = splat.shake;
      // The peel's shape settles back to 1 while a wobble on top of it dies out.
      const fade = (1 - p) * Math.exp(-decay * p);
      const wobble = Math.sin(TWO_PI * cycles * p) * fade;
      const settle = (1 - p) * (1 - p);
      out.scaleX = 1 + (peel.scaleX - 1) * settle + amount * wobble * 0.5;
      out.scaleY = 1 + (peel.scaleY - 1) * settle - amount * wobble;
      out.tilt = tiltDeg * DEG_TO_RAD * Math.sin(TWO_PI * cycles * p) * fade;
      return out;
    }
    default:
      return out;
  }
}

/** Length of a stage of the splat that has a fixed length (`hold` is drawn per visit). */
export function stageMs(phase: GuestPhase): number {
  switch (phase) {
    case 'squash':
      return splat.squashMs;
    case 'peel':
      return splat.peelMs;
    case 'shake':
      return splat.shakeMs;
    default:
      return 0;
  }
}
