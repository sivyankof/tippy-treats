import { TOWER_GUEST } from '../../data/tower-guest';
import { hasRule } from '../../core/zones';
import type { LayerRuleKind } from '../../data/zones';
import {
  DEG_TO_RAD,
  clamp01,
  easeInQuad,
  easeOutQuad,
  lerp,
  pickRange,
  sineWave,
  TWO_PI,
} from '../../util/math';

const { splat } = TOWER_GUEST;

/** Where a visit is: coming in, resting, leaving, or the stages of a splat. */
export type GuestPhase =
  'away' | 'arrive' | 'sit' | 'leave' | 'squash' | 'hold' | 'peel' | 'inflate' | 'shake' | 'flee';

/** The stages of a splat that show the guest's splat shape, in order. */
export const SPLAT_STAGES: readonly GuestPhase[] = ['squash', 'hold', 'peel', 'inflate', 'shake'];

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

/** A guest `halfBody` wide at offset `x` is clear of the `span` by the shadow gap on both sides (any `x` when there is none). */
export function clearOfSpan(x: number, halfBody: number, span: Span | null): boolean {
  if (!span) return true;
  const gap = TOWER_GUEST.site.shadowGapPx;
  return x + halfBody + gap < span.left || x - halfBody - gap > span.right;
}

/** The next layer with this rule (`null`: not known yet) is aimed by its shadow alone. */
export function aimedByShadowOnly(
  layer: { rule: LayerRuleKind; rule2: LayerRuleKind | null } | null,
): boolean {
  return layer !== null && TOWER_GUEST.shadowOnlyRules.some((rule) => hasRule(layer, rule));
}

/**
 * Where on a layer `width` wide, whose face takes `faceHalf` on each side of the centre, a guest
 * `halfBody` wide can sit: its offset from the centre, or `null` when there is no room beside the
 * face. `side` is -1 or 1, `reach` is 0..1 along the free stretch (0 is next to the face).
 * `avoid` (the shadow of the flying layer, as offsets from the centre) is kept clear when the
 * other choice allows it: the guest then sits as near the free end as the shadow leaves.
 * `blocked` is a side the guest never sits on (the side of a topper): only the other side is tried.
 */
export function siteOffset(
  width: number,
  faceHalf: number,
  halfBody: number,
  side: -1 | 1,
  reach: number,
  avoid: Span | null = null,
  blocked: -1 | 1 | null = null,
): number | null {
  const { faceGapPx, edgeGapPx } = TOWER_GUEST.site;
  const near = faceHalf + faceGapPx + halfBody;
  const far = width / 2 - edgeGapPx - halfBody;
  if (far < near) return null;
  const chosen = blocked !== null && side === blocked ? -side : side;
  const offset = chosen * lerp(near, far, clamp01(reach));
  if (clearOfSpan(offset, halfBody, avoid)) return offset;
  if (blocked !== null) return null;
  const other = -offset;
  return clearOfSpan(other, halfBody, avoid) ? other : null;
}

/**
 * Picks where a guest `halfBody` wide sits on a top layer `width` wide whose face takes `faceHalf`
 * on each side (offset from its centre, `null` when there is no room). A guest bound for the path
 * of the next layer (`onPath`) sits within `nextWidth` over the top layer's centre and near the
 * face (`site.pathReach`), where even an off-aim landing covers it; any other one anywhere beside
 * the face (`site.reach`). The side and the place come from `random`; `avoid` is kept clear as in
 * `siteOffset`, and so is the `blocked` side.
 */
export function chooseSite(
  width: number,
  faceHalf: number,
  halfBody: number,
  nextWidth: number,
  onPath: boolean,
  random: () => number,
  avoid: Span | null = null,
  blocked: -1 | 1 | null = null,
): number | null {
  const side: -1 | 1 = random() < 0.5 ? -1 : 1;
  const { pathReach, reach } = TOWER_GUEST.site;
  const along = pickRange(onPath ? pathReach : reach, random);
  const room = onPath ? Math.min(width, nextWidth) : width;
  return siteOffset(room, faceHalf, halfBody, side, along, avoid, blocked);
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

/** A zigzag whose swing grows and shrinks by `share` of it, `cycles` times along the way. */
export interface Stagger {
  share: number;
  cycles: number;
}

/**
 * Point `t` (0..1) of a flight from (`fromX`, `fromY`) to (`toX`, `toY`): a straight way with
 * sharp zigzag turns across it, `cycles` turns of `zigzagPx` that die out at both ends; with a
 * `stagger` the swing is uneven, as if the flier reels. `ease` shapes the progress along the way.
 * Fills and returns `out`.
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
  stagger: Stagger | null = null,
): FlightPoint {
  const p = ease(clamp01(t));
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy) || 1;
  // Triangle wave in -1..1, its envelope is 0 at both ends.
  const phase = (clamp01(t) * cycles) % 1;
  const tri = 1 - 4 * Math.abs(phase - 0.5);
  const envelope = Math.min(1, clamp01(t) * 4, (1 - clamp01(t)) * 4);
  const reel = stagger ? 1 + stagger.share * Math.sin(TWO_PI * stagger.cycles * clamp01(t)) : 1;
  const side = tri * envelope * zigzagPx * reel;
  out.x = fromX + dx * p + (-dy / length) * side;
  out.y = fromY + dy * p + (dx / length) * side;
  return out;
}

/** Shape of the guest picture: which picture, its scales (1 is the normal size) and the tilt in radians. */
export interface GuestShape {
  /** The flat picture (a pancake with crossed-out eyes) instead of the normal one. */
  flat: boolean;
  scaleX: number;
  scaleY: number;
  tilt: number;
}

/**
 * The shape of the guest `inMs` into a stage of the splat: it squashes, the flat picture pops in
 * and gloops while held, stretches up as it peels and pops out as a crumpled normal picture,
 * inflates back with a spring and shakes its head. Every stage starts where the one before it
 * ended, and the shake ends exactly at the normal shape. Fills and returns `out`.
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
      const tilt = -peel.tiltDeg * DEG_TO_RAD;
      if (p < peel.popAt) {
        const q = easeInQuad(p / peel.popAt);
        out.flat = true;
        out.scaleX = lerp(1, peel.stretch.scaleX, q);
        out.scaleY = lerp(1, peel.stretch.scaleY, q);
        out.tilt = tilt * (p / peel.popAt);
      } else {
        out.scaleX = peel.pop.scaleX;
        out.scaleY = peel.pop.scaleY;
        out.tilt = tilt * (1 - (p - peel.popAt) / (1 - peel.popAt));
      }
      return out;
    }
    case 'inflate': {
      const p = clamp01(inMs / splat.inflateMs);
      const { cycles, decay } = splat.inflate;
      // A damped spring from the crumpled shape: it overshoots the normal size and ends exactly on it.
      const spring = (1 - p) * Math.exp(-decay * p) * Math.cos(TWO_PI * cycles * p);
      out.scaleX = 1 + (peel.pop.scaleX - 1) * spring;
      out.scaleY = 1 + (peel.pop.scaleY - 1) * spring;
      return out;
    }
    case 'shake': {
      const p = clamp01(inMs / splat.shakeMs);
      const { amount, cycles, decay, tiltDeg } = splat.shake;
      const fade = (1 - p) * Math.exp(-decay * p);
      const swing = Math.sin(TWO_PI * cycles * p) * fade;
      out.scaleX = 1 + amount * Math.abs(swing) * 0.5;
      out.scaleY = 1 - amount * Math.abs(swing);
      out.tilt = tiltDeg * DEG_TO_RAD * swing;
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
    case 'inflate':
      return splat.inflateMs;
    case 'shake':
      return splat.shakeMs;
    default:
      return 0;
  }
}

/** One star circling over the guest's head: offset from its feet (pixels), drawn scale, in front or behind. */
export interface OrbitStar {
  x: number;
  y: number;
  scale: number;
  front: boolean;
}

/**
 * Star `index` of `splat.orbit.count` circling over the guest's head `timeMs` into the circling:
 * on an ellipse `liftPx` above the feet, the far half smaller. Fills and returns `out`.
 */
export function orbitStar(index: number, timeMs: number, out: OrbitStar): OrbitStar {
  const { count, radiusXPx, radiusYPx, liftPx, periodMs, scale, farScale } = splat.orbit;
  const angle = TWO_PI * (timeMs / periodMs + index / count);
  const depth = Math.sin(angle);
  out.x = Math.cos(angle) * radiusXPx;
  out.y = depth * radiusYPx - liftPx;
  out.front = depth >= 0;
  out.scale = scale * lerp(farScale, 1, (depth + 1) / 2);
  return out;
}

/** Phase step between two neighbouring legs, a share of the shiver period, so no two move together. */
const TREMBLE_STEP = 0.37;

/**
 * How far leg or wing `index` of the pancake swings now (radians): a quick shiver of up to
 * `amountDeg`, each one out of step with the others.
 */
export function trembleAngle(index: number, timeMs: number, amountDeg: number): number {
  const { periodMs } = splat.tremble;
  return amountDeg * DEG_TO_RAD * sineWave(timeMs + index * periodMs * TREMBLE_STEP, periodMs);
}
