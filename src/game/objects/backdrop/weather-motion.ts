import { WEATHER_LOOK } from '../../../data/weather-look';
import { clamp01 } from '../../../util/math';

/** `value` wrapped into the range [-pad, size + pad). */
export function wrapRange(value: number, size: number, pad: number): number {
  const span = size + 2 * pad;
  return ((((value + pad) % span) + span) % span) - pad;
}

/**
 * How visible a particle at height `y` is: 0 inside the stripe of the incoming layer, rising to 1
 * `feather` px away from its edges, and fading in/out over `endFeather` px at the screen top and bottom.
 */
export function particleFade(
  y: number,
  band: { top: number; bottom: number },
  feather: number,
  screenH: number,
  endFeather: number,
): number {
  if (y >= band.top && y <= band.bottom) return 0;
  const fade =
    y < band.top ? clamp01((band.top - y) / feather) : clamp01((y - band.bottom) / feather);
  const ends = Math.min(y, screenH - y) / endFeather;
  return fade * clamp01(ends);
}

/** Time of the next bolt after `now`, given a draw `u` in 0..1 and the pause range. */
export function nextBoltAt(now: number, range: readonly [number, number], u: number): number {
  return now + range[0] + (range[1] - range[0]) * u;
}

/** Strength of a flash 0..1 `elapsed` ms into one lasting `length` ms: a quick rise, a longer fall. */
export function flashEnvelope(elapsed: number, length: number): number {
  if (elapsed < 0 || elapsed >= length) return 0;
  const t = elapsed / length;
  const rise = WEATHER_LOOK.lightning.riseShare;
  return t < rise ? t / rise : 1 - (t - rise) / (1 - rise);
}

/** Height of the cloud bank's lower edge (picture px) at picture x `px`: the lowest of the band and the lobes there. */
export function bankEdge(px: number): number {
  const b = WEATHER_LOOK.bank;
  let edge: number = b.bodyBottom;
  for (const [cx, cy, r] of b.lumps) {
    const rx = (r * b.lobeWide) / 2;
    const ry = (r * b.lobeTall) / 2;
    const t = (px - cx) / rx;
    if (Math.abs(t) < 1) edge = Math.max(edge, cy + ry * Math.sqrt(1 - t * t));
  }
  return edge;
}
