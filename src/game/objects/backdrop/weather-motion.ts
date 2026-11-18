import { WEATHER_LOOK } from '../../../data/weather-look';
import type { EffectLevel } from '../../../data/effect-levels';
import { clamp01 } from '../../../util/math';
import { hudKeepOutFade } from '../../camera-layout';

/** `value` wrapped into the range [-pad, size + pad). */
export function wrapRange(value: number, size: number, pad: number): number {
  const span = size + 2 * pad;
  return ((((value + pad) % span) + span) % span) - pad;
}

/** The sideways step of the lattice of drop starts: stepping by it spreads points over 0..1 with no part left empty (picked, among steps near the golden ratio's, for the steadiest count of drops beside a wide tower, see the test). */
const SIDE_STEP = 0.378;
/** The step that orders the drops down the screen: another irrational, so that it does not follow the sideways one. */
const DEPTH_STEP = 0.5698402909980532;

/**
 * Moves an even spread `u` (0..1) so that `outsideShare` of it falls into the two outer strips of the width (each
 * `stripShare / 2` wide) and the rest over the middle, each part still even: the tower hides the middle, so the drops
 * move to where they are seen.
 */
export function sideWarp(u: number, outsideShare: number, stripShare: number): number {
  const half = stripShare / 2;
  if (u >= outsideShare) return half + ((u - outsideShare) / (1 - outsideShare)) * (1 - stripShare);
  const t = (u / outsideShare) * 2;
  return t < 1 ? t * half : 1 - half + (t - 1) * half;
}

/**
 * Start spots (`u` across, `v` down, both 0..1) of `count` raindrops. All the heights are the cells of an even
 * grid, but dealt out in the order of a low-discrepancy sequence, so for ANY first N drops (a lighter effects level
 * shows only a prefix) they cover the height evenly, and all of them fill it with no gap. Across, the drops step
 * by `SIDE_STEP` from a random offset (the order of the heights is the same for every run). Each spot moves a little (`jitterShare` of a cell) so no lattice shows.
 */
export function rainSpots(
  count: number,
  next: () => number,
  jitterShare = 0.3,
): { u: number; v: number }[] {
  const offset = next();
  const wrap01 = (x: number): number => x - Math.floor(x);
  // The lattice: cell c has its own height and its own place across (jitter drawn in the cell order).
  const lattice = Array.from({ length: count }, (_, c) => ({
    u: wrap01(offset + c * SIDE_STEP + ((next() - 0.5) * jitterShare) / count),
    v: wrap01((c + 0.5 + (next() - 0.5) * jitterShare) / count),
  }));
  // Drop k takes the cell whose rank among the cells is the rank of k in the depth sequence: any prefix of drops
  // then covers the height evenly.
  const byDepth = lattice
    .map((_, k) => k)
    .sort((p, q) => wrap01(p * DEPTH_STEP) - wrap01(q * DEPTH_STEP));
  const spots = new Array<{ u: number; v: number }>(count);
  byDepth.forEach((k, rank) => (spots[k] = lattice[rank]!));
  return spots;
}

/**
 * Height of a raindrop `seconds` into its fall. Rain falls in the part of the screen under the HUD (from `top`
 * to the bottom of the screen `height`, `padPx` more at both ends before it wraps): above `top` the plates hide
 * the sides anyway, and a drop spent there would be lost; the drop fades in over `padPx` under `top`. The
 * stripe of the incoming layer (`band`) is invisible too, so a drop skips it: it is invisible at both edges of
 * the stripe, and the time it would spend inside is not lost.
 */
export function rainY(
  v: number,
  speed: number,
  seconds: number,
  top: number,
  height: number,
  padPx: number,
  band: { top: number; bottom: number } = { top: height, bottom: height },
): number {
  const skipFrom = Math.min(Math.max(band.top, top), height);
  const skip = Math.min(Math.max(band.bottom - skipFrom, 0), height - skipFrom);
  const span = height - top - skip;
  const y = top + wrapRange(v * span + speed * seconds, span, padPx);
  return y >= skipFrom ? y + skip : y;
}

/**
 * x of a raindrop at height `y`. It starts at `u` (0..1, evenly spread over the drops) across the ring of the screen
 * width plus `marginPx` beyond both edges, and leans by `slant` px per px of fall from the height `top`. The ring
 * wraps: a drop that leans out of one edge comes in at the other one beyond the screen (the margin hides the jump),
 * so the drops are spread evenly over the whole width at every height (no lanes, no columns) and none of the fall is
 * spent off screen. The lean depends on the height, not on the time.
 */
export function rainX(
  u: number,
  slant: number,
  y: number,
  top: number,
  width: number,
  marginPx: number,
): number {
  return wrapRange(u * (width + 2 * marginPx) - marginPx + slant * (y - top), width, marginPx);
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

/**
 * A pool of its own size and look (the street behind the Showcase glass): `count` pictures on the full level and
 * the same share of them as the Roof's on the lower levels; alpha and size are scaled.
 */
export interface FallView {
  count: number;
  /** Rain only: this share of the drops start in the two outer strips of the screen width (`towerShare` is the tower's, in the middle). */
  outside?: { share: number; stripShare: number };
  /** Rain only: the lean of the fall is this share of the Roof's (the street is far, the rain falls steeper there and keeps where it started). */
  slantShare?: number;
  /** Snow only: the share of the flakes that start in the two side strips, and the strip width (shares of the screen); the Roof's own when unset. */
  sides?: { bias: number; share: number };
  /** How many show on each level, when that is not the level's share of `count` (the street fills what the glass leaves of the level limit). */
  shown?: Record<EffectLevel, number>;
  alpha: number;
  scale: number;
}

/**
 * How many pictures of a pool show on a level: the Roof's rain leaves room for its splashes, every other pool
 * (and every pool of its own look) shows the level's share of it.
 */
export function fallShown(
  pool: number,
  level: EffectLevel,
  rain: boolean,
  view: FallView | null,
): number {
  if (rain && !view) return rainDropsShown(pool, level);
  if (view?.shown) return Math.min(pool, view.shown[level]);
  return Math.round((pool * WEATHER_LOOK.particleCount[level]) / WEATHER_LOOK.particleCount.full);
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
