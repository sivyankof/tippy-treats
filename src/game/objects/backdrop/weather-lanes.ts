import type { Rng } from '../../../core/rng';
import { WEATHER_LOOK } from '../../../data/weather/weather-look';

const SNOW = WEATHER_LOOK.snow;

/** Where a flake starts: its lane, the lane's x and its y (shares of the screen). */
export interface SnowSpot {
  lane: number;
  u: number;
  v: number;
}

/** The wanted x (share of the width) of a particle: with chance `bias` in one of the two side strips of width `share`, else anywhere. */
export function startU(rng: Rng, bias: number, share: number): number {
  if (!rng.chance(bias)) return rng.next();
  return rng.chance(0.5) ? rng.range(0, share) : rng.range(1 - share, 1);
}

/** How many lanes fit the width (px) at the lanes' minimum distance. */
export function laneCount(width: number, gap: number): number {
  return Math.max(1, Math.floor(width / gap));
}

/** The x (share of the width) of the middle of a lane. */
export function laneU(lane: number, lanes: number): number {
  return (lane + 0.5) / lanes;
}

/** Distance (share of the height) of two y's on a screen that wraps around. */
export function wrapGap(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

/**
 * Places `count` flakes in vertical lanes. A flake takes the lane nearest its wanted x that is not full. A lane
 * is cut into `laneCap` equal slots down the screen (turned by a draw of its own); a flake takes a free slot
 * and moves within it by less than the slack, so two flakes of a lane are never closer than the minimum gap.
 * The flakes of one lane share a speed, so their gap holds as they fall; the lanes are wider apart than a
 * flake can sway, so lanes never touch.
 */
export function snowSpots(
  count: number,
  lanes: number,
  drawU: () => number,
  drawV: () => number,
): SnowSpot[] {
  const cap = SNOW.laneCap;
  const slot = 1 / cap;
  // The share of a slot a flake may move within: what is left once the minimum gap is kept.
  const slack = Math.max(0, slot - SNOW.minGapPx / SNOW.gapRefHeight);
  const free: number[][] = Array.from({ length: lanes }, () =>
    Array.from({ length: cap }, (_, k) => k),
  );
  const turn = Array.from({ length: lanes }, () => drawV());
  const spots: SnowSpot[] = [];
  for (let i = 0; i < count; i++) {
    const want = drawU();
    const order = free
      .map((_, lane) => lane)
      .sort((a, b) => Math.abs(laneU(a, lanes) - want) - Math.abs(laneU(b, lanes) - want));
    const lane = order.find((l) => (free[l]?.length ?? 0) > 0) ?? order[0] ?? 0;
    const open = free[lane] ?? [];
    const k = open.splice(Math.floor(drawV() * open.length), 1)[0] ?? 0;
    const v = (turn[lane] ?? 0) + k * slot + (drawV() - 0.5) * slack;
    const jitter = (drawV() - 0.5) * 2 * SNOW.laneJitter;
    spots.push({ lane, u: laneU(lane, lanes) + jitter / lanes, v: ((v % 1) + 1) % 1 });
  }
  return spots;
}
