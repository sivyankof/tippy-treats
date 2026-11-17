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

/** One round puff of the cloud bank (picture px): its row (0 back, 1 middle, 2 front), centre and radius. */
export interface Puff {
  row: number;
  x: number;
  y: number;
  r: number;
}

/** The puffs of a bank, front rows last (so they paint over the back ones); a storm hangs the lower rows lower. */
export function bankPuffs(storm: boolean): Puff[] {
  const b = WEATHER_LOOK.bank;
  return b.puffs
    .map(([row, x, y, r]) => ({
      row,
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
