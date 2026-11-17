import type { Rng } from '../../../core/rng';
import { WEATHER_LOOK } from '../../../data/weather-look';
import type { EffectLevel } from '../../../data/effect-levels';
import { clamp01 } from '../../../util/math';
import { hudKeepOutFade } from '../../camera-layout';

/** `value` wrapped into the range [-pad, size + pad). */
export function wrapRange(value: number, size: number, pad: number): number {
  const span = size + 2 * pad;
  return ((((value + pad) % span) + span) % span) - pad;
}

/** x (share of the width) in the left (side 0) or right (side 1) strip of width `strip`, at least `edge` in from the strip's outer edge and from the tower's side. */
export function sideU(rng: Rng, side: number, strip: number, edge: number): number {
  return side === 0 ? rng.range(edge, strip - edge) : rng.range(1 - strip + edge, 1 - edge);
}

/**
 * How far a raindrop leans per px of fall: `slant`, eased on a screen taller than
 * `WEATHER_LOOK.leanRefHeight` (the drop still looks slanted, its picture is turned by this), and
 * never more than makes the whole pass (`height` plus `padPx` at both ends) lean `leanMaxPx` either way
 * of the lane, so the drop stays inside its side strip.
 */
export function rainSlope(slant: number, height: number, leanMaxPx = Infinity, padPx = 0): number {
  const ease = Math.min(1, WEATHER_LOOK.leanRefHeight / height);
  return Math.min(slant * ease, leanMaxPx / (height / 2 + padPx));
}

/**
 * x of a raindrop at height `y`: its lane `u` (share of the width) on the middle of the screen, leaning
 * by `rainSlope` px per px of fall. The lean depends on the height, not on the time, so a drop that starts
 * in a side strip stays near that strip on every pass instead of drifting across the whole width
 * (a time-based drift spread the drops evenly, and most of them fell behind the tower).
 */
export function rainX(
  u: number,
  width: number,
  slant: number,
  y: number,
  height: number,
  leanMaxPx = Infinity,
  padPx = 0,
): number {
  return u * width + rainSlope(slant, height, leanMaxPx, padPx) * (y - height / 2);
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

/** How many raindrops show at an effects level: the particle limit of the level less the splashes that may stand at once. */
export function rainDropsShown(pool: number, level: EffectLevel): number {
  return Math.min(pool, WEATHER_LOOK.particleCount[level] - WEATHER_LOOK.splash.maxShown[level]);
}

/** One round puff of the cloud bank (picture px): its row (0 back, 1 middle, 2 front), centre and radius. */
export interface Puff {
  row: number;
  x: number;
  y: number;
  r: number;
  /** A thin seam is drawn along its top. */
  seam: boolean;
}

/** The puffs of a bank, front rows last (so they paint over the back ones); a storm hangs the lower rows lower. */
export function bankPuffs(storm: boolean): Puff[] {
  const b = WEATHER_LOOK.bank;
  return b.puffs
    .map(([row, x, y, r, seam]) => ({
      row,
      seam: seam === 1,
      x,
      y: y + (storm ? (r * b.stormHang * row) / 2 : 0),
      r,
    }))
    .sort((p, q) => p.row - q.row);
}

/** Height of the cloud bank's lower edge (picture px) at picture x `px`: the lowest of the top strip and the puffs there. */
export function bankEdge(px: number, storm = false): number {
  let edge: number = WEATHER_LOOK.bank.topStripPx;
  for (const p of bankPuffs(storm)) {
    const dx = Math.abs(px - p.x);
    if (dx < p.r) edge = Math.max(edge, p.y + Math.sqrt(p.r * p.r - dx * dx));
  }
  return edge;
}

/** A HUD plate (screen px). */
interface Plate {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * How far down a bolt at screen x `x` (half width `half`) may run, from `top` towards `wantEnd`, so that it
 * stays `gap` px from every plate: a plate the bolt is level with sideways stops it `gap` above that plate.
 * `null` when a plate lies over its top end.
 */
export function boltEnd(
  x: number,
  half: number,
  top: number,
  wantEnd: number,
  plates: readonly Plate[],
  gap: number,
): number | null {
  let end = wantEnd;
  for (const p of plates) {
    const sideways = Math.max(p.x - (x + half), x - half - (p.x + p.width));
    if (sideways >= gap) continue;
    if (p.y + p.height + gap > top && p.y - gap < top) return null;
    if (p.y > top) end = Math.min(end, p.y - gap);
  }
  return end;
}

/** Points along a streak that are tested against the HUD plates (the two ends, the middle and between). */
const STREAK_SAMPLES = [-1, -0.5, 0, 0.5, 1] as const;

/**
 * How visible a weather particle centred at (`x`, `y`) is near the HUD plates: 0 while ANY part of it is within the HUD gap
 * plus `keepOutMarginPx`, then rising to 1 over `feather` px. `radius` is the half width of the picture (the half size of a
 * round one). A streak (a raindrop) is also `halfLen` px long to each side of its centre along its own axis, turned by
 * `rotation` (radians, as the image is rotated).
 */
export function particleKeepOut(
  x: number,
  y: number,
  feather: number,
  radius = 0,
  halfLen = 0,
  rotation = 0,
): number {
  const margin = WEATHER_LOOK.keepOutMarginPx + radius;
  if (halfLen <= 0) return hudKeepOutFade(x, y, margin, feather);
  // Far from every plate even with the whole streak counted as a disc: nothing to test.
  if (hudKeepOutFade(x, y, margin + halfLen, feather) >= 1) return 1;
  const dx = -Math.sin(rotation) * halfLen;
  const dy = Math.cos(rotation) * halfLen;
  let fade = 1;
  for (const s of STREAK_SAMPLES) {
    fade = Math.min(fade, hudKeepOutFade(x + dx * s, y + dy * s, margin, feather));
    if (fade <= 0) return 0;
  }
  return fade;
}
