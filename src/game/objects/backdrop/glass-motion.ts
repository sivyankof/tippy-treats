import { GLASS_LOOK, type GlassWeather } from '../../../data/window-look';
import { GOLDEN, TWO_PI, lerp } from '../../../util/math';

const PLASTIC = 0.754878;

function frac(value: number): number {
  return value - Math.floor(value);
}

/** Where one thing on the glass is: `u`, `v` in 0..1 across the glass, with its alpha, size and turn. */
export interface GlassPose {
  u: number;
  v: number;
  alpha: number;
  scale: number;
  rotation: number;
}

export function newGlassPose(): GlassPose {
  return { u: 0, v: 0, alpha: 0, scale: 1, rotation: 0 };
}

/** 0 at the ends of a cycle `p` (0..1), 1 in the middle; the ends are `GLASS_LOOK.fadeShare` long. */
export function cycleFade(p: number): number {
  const edge = GLASS_LOOK.fadeShare;
  return Math.min(1, p / edge, (1 - p) / edge);
}

/**
 * Pose of item `i` of `count` at time `timeMs`. Items start at golden-ratio spread places and
 * phases, so no two run in step and nothing needs a random source. A drop slides down the glass,
 * a flake falls and sways, a leaf drifts across and turns.
 */
export function glassPose(
  spec: GlassWeather,
  i: number,
  timeMs: number,
  out: GlassPose,
): GlassPose {
  const [fast, slow] = spec.periodMs;
  const period = lerp(fast, slow, frac(i * 0.37 + 0.11));
  const p = frac(timeMs / period + frac(i * PLASTIC + 0.1));
  const lane = frac(i * GOLDEN + 0.2);
  const margin = GLASS_LOOK.margin;
  out.v = margin + (1 - 2 * margin) * p;
  out.u = margin + (1 - 2 * margin) * lane;
  out.alpha = cycleFade(p);
  out.scale = 0.85 + 0.3 * frac(i * 0.61);
  out.rotation = 0;
  if (spec.item === 'flake') {
    const sway = GLASS_LOOK.sway.flake;
    out.u += sway.share * Math.sin(TWO_PI * (timeMs / sway.ms + i * 0.17));
  } else if (spec.item === 'leaf') {
    const sway = GLASS_LOOK.sway.leaf;
    const wave = Math.sin(TWO_PI * (timeMs / sway.ms + i * 0.29));
    out.u += sway.share * wave;
    out.rotation = 0.9 * wave + TWO_PI * 0.4 * p;
  }
  return out;
}
