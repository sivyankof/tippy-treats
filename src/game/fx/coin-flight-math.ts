/** Pure maths of the coins that fly into the HUD counter: payout split, arc path, spin and the counter catch-up. */
import { clamp01, smoothstep } from '../../util/math';
import { shapeAt } from './abilities/sprite-motion';

export interface Point {
  x: number;
  y: number;
}

/** How one coin travels: it waits, hops where it lies, then flies on an arc to the target. */
export interface FlightPlan {
  delayMs: number;
  hopMs: number;
  hopPx: number;
  flightMs: number;
  /** The path bulges up by this much in the middle. */
  arcPx: number;
  startScale: number;
  endScale: number;
}

/** Where a flight is and how it looks; `sampleFlight` fills a reused one. */
export interface FlightFrame {
  x: number;
  y: number;
  scale: number;
  /** `false` before the delay is over and after the landing. */
  visible: boolean;
  done: boolean;
}

/**
 * Shares a payout between at most `maxCoins` pictures: whole numbers that add up to the
 * rounded amount, as even as possible (the first ones get the remainder). A payout of
 * nothing has no pictures.
 */
export function splitAmount(amount: number, maxCoins: number): number[] {
  const total = Math.max(0, Math.round(amount));
  if (total === 0 || maxCoins <= 0) return [];
  const count = Math.min(total, Math.floor(maxCoins));
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Point at progress `t` (0..1) on the way from `from` to `to`, bulging up by `arc` in the middle. */
export function arcPoint(from: Point, to: Point, t: number, arc: number, out: Point): Point {
  const c = clamp01(t);
  out.x = from.x + (to.x - from.x) * c;
  out.y = from.y + (to.y - from.y) * c - arc * Math.sin(Math.PI * c);
  return out;
}

/** Height of a hop at progress `t` (0..1): up and back down. */
export function hopHeight(t: number, hopPx: number): number {
  return hopPx * shapeAt('bump', t);
}

/** Width scale of a spinning coin: it squashes between `minScale` and 1 with the given period. */
export function spinScale(ageMs: number, periodMs: number, minScale: number): number {
  return minScale + (1 - minScale) * Math.abs(Math.cos((Math.PI * ageMs) / periodMs));
}

/** Total length of a flight, delay included. */
export function flightLifeMs(plan: Pick<FlightPlan, 'delayMs' | 'hopMs' | 'flightMs'>): number {
  return plan.delayMs + plan.hopMs + plan.flightMs;
}

/** Pose of a coin `ageMs` after its flight was started. `out` is reused. */
export function sampleFlight(
  plan: FlightPlan,
  from: Point,
  to: Point,
  ageMs: number,
  out: FlightFrame,
  scratch: Point,
): FlightFrame {
  const local = ageMs - plan.delayMs;
  out.done = ageMs >= flightLifeMs(plan);
  out.visible = local >= 0 && !out.done;
  if (local < plan.hopMs) {
    const t = plan.hopMs > 0 ? local / plan.hopMs : 0;
    out.x = from.x;
    out.y = from.y - hopHeight(t, plan.hopPx);
    out.scale = plan.startScale;
    return out;
  }
  const t = smoothstep((local - plan.hopMs) / plan.flightMs);
  arcPoint(from, to, t, plan.arcPx, scratch);
  out.x = scratch.x;
  out.y = scratch.y;
  out.scale = plan.startScale + (plan.endScale - plan.startScale) * t;
  return out;
}

/**
 * What a counter shows: the run total minus the coins still on their way, so the number rises
 * as each coin arrives and always ends on the total.
 */
export function shownTotal(total: number, pending: number): number {
  return Math.max(0, total - Math.max(0, pending));
}
