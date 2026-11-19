import { CREATURE_SLEEP } from '../../data/creatures/creature-style';

/** Where one floating "z" is and how it looks, offsets from its anchor at scale 1. */
export interface ZPose {
  x: number;
  y: number;
  alpha: number;
  scale: number;
}

/**
 * One letter of the sleep loop: it starts at the anchor small and transparent, fades in, rises and
 * drifts sideways while it grows, fades out at the top. Letters are spread evenly over the loop.
 */
export function zPose(timeMs: number, index: number, out: ZPose): ZPose {
  const { count, periodMs, rise, drift, fadeIn, fadeOut, growFrom } = CREATURE_SLEEP.zs;
  const phase = (((timeMs / periodMs + index / count) % 1) + 1) % 1;
  const rising = Math.min(1, phase / fadeIn);
  const falling = Math.min(1, (1 - phase) / fadeOut);
  out.alpha = Math.min(rising, falling);
  out.x = drift * phase;
  out.y = -rise * phase;
  out.scale = growFrom + (1 - growFrom) * phase;
  return out;
}
