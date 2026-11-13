import { BALANCE } from '../data/balance';
import { TWO_PI } from '../util/math';

const W = BALANCE.wobble;

const clamp = (value: number): number => Math.min(W.max, Math.max(0, value));

/** Wobble after a normal drop that landed `dx` off a layer of the given width. */
export function wobbleAfterNormal(wobble: number, dx: number, width: number): number {
  return clamp(wobble + (W.gainFactor * Math.abs(dx)) / width);
}

export function wobbleAfterPerfect(wobble: number): number {
  return clamp(wobble - W.perfectRelief);
}

export function decayWobble(wobble: number, dtMs: number): number {
  return clamp(wobble - (W.decayPerSec * dtMs) / 1000);
}

export function advanceWobblePhase(phase: number, dtMs: number): number {
  return (phase + (TWO_PI * dtMs) / W.periodMs) % TWO_PI;
}

/** Sway amplitude of the top layer. */
export function wobbleAmplitude(wobble: number): number {
  return W.amplitudeMax * Math.pow(clamp(wobble) / W.max, W.amplitudeExponent);
}

/** Horizontal sway of a layer `depth` layers below the top (0 is the top). */
export function wobbleOffset(wobble: number, phase: number, depth: number): number {
  const falloff = Math.pow(Math.max(0, 1 - depth / W.depthFalloffLayers), W.depthExponent);
  return wobbleAmplitude(wobble) * falloff * Math.sin(phase);
}

export function isSneezing(wobble: number): boolean {
  return wobble >= W.max;
}

/** Width of the top layer after the tower sneezes. */
export function widthAfterSneeze(width: number): number {
  return width * (1 - W.sneezeWidthLoss);
}

export const WOBBLE_AFTER_SNEEZE = W.sneezeResetTo;
