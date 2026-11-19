import { spaceWidthLimit, lapFirstIndex } from '../../../core/space-laps';
import { PlanetWalk } from '../../../core/space-planet';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { PLANET_DIM, PLANET_PLACE, type SpacePlanetId } from '../../../data/zones/space-planets';
import { planetSize } from './dessert-planets';
import { clamp01 } from '../../../util/math';
import { flightClearBand } from '../../camera-layout';

/** The lane of a planet and the scale it is shown at there. */
export interface PlanetFit {
  x: number;
  scale: number;
}

/** Half of a picture: its centre to its edge. */
const HALF = 0.5;

/**
 * Half width of the corridor the planet keeps out of: half the width cap of the lap, between the dashed lines,
 * centred on the screen. Lap 1 has no lines; its cap is the full layer width.
 */
export function corridorHalf(lap: number): number {
  return spaceWidthLimit(lapFirstIndex(lap)) / 2;
}

/**
 * Centre x of a planet `width` wide in its lane: on `side` (0 left, 1 right) of the lap corridor (with `lineGap`),
 * at its preferred distance from the screen edge, pushed into the lane; at most `edgeCut` of its width hangs off
 * the screen edge. `null` when the lane has no room.
 */
export function planetLaneX(
  lap: number,
  screenW: number,
  width: number,
  side: 0 | 1,
  edgeCut: number = PLANET_PLACE.edgeCut,
): number | null {
  const { lineGap } = PLANET_PLACE;
  const inset = width * (HALF - edgeCut);
  const half = corridorHalf(lap);
  const centre = LOGICAL_SIZE.width / 2;
  const preferLeft = screenW * PLANET_PLACE.x;
  const lane =
    side === 0
      ? { lo: inset, hi: centre - half - lineGap - width / 2, prefer: preferLeft }
      : {
          lo: centre + half + lineGap + width / 2,
          hi: screenW - inset,
          prefer: screenW - preferLeft,
        };
  return lane.lo <= lane.hi ? Math.min(Math.max(lane.prefer, lane.lo), lane.hi) : null;
}

/**
 * The lane of the planet of a lap on `side` at the largest scale from `PLANET_PLACE.scale` down to `minScale`
 * (in `scaleStep` steps) that has room by the rules of place; `width` is the unscaled picture. The corridor is
 * centred, so the two lanes are as wide and the side does not change the scale. `null` when it has no room even at
 * `minScale` (see `planetPlace` for where it stands then).
 */
export function planetFit(
  lap: number,
  screenW: number,
  width: number,
  side: 0 | 1,
): PlanetFit | null {
  const { scale, minScale, scaleStep } = PLANET_PLACE;
  // A misconfigured ladder (min above the scale, no step) tries the scale alone.
  const span = (scale - minScale) / scaleStep;
  const steps = Number.isFinite(span) && span > 0 ? Math.round(span) : 0;
  for (let i = 0; i <= steps; i++) {
    const k = scale - i * scaleStep;
    const x = planetLaneX(lap, screenW, width * k, side);
    if (x !== null) return { x, scale: k };
  }
  return null;
}

/**
 * Where the planet of a lap stands, always: `planetFit`, or, when it has no room even at `minScale`, at `minScale`
 * close against the corridor, hanging off the screen edge by up to `fallbackEdgeCut` (the corridor wins over the
 * edge; only past that cut would it touch the corridor).
 */
export function planetPlace(lap: number, screenW: number, width: number, side: 0 | 1): PlanetFit {
  const fit = planetFit(lap, screenW, width, side);
  if (fit) return fit;
  const scale = PLANET_PLACE.minScale;
  const w = width * scale;
  const x = planetLaneX(lap, screenW, w, side, PLANET_PLACE.fallbackEdgeCut);
  if (x !== null) return { x, scale };
  const inset = w * (HALF - PLANET_PLACE.fallbackEdgeCut);
  return { x: side === 0 ? inset : screenW - inset, scale };
}

/** Walks kept per seed: a lap change is one step of a walk, not a replay from lap 1. */
const walks = new Map<number, PlanetWalk>();
const MAX_WALKS = 8;

/** The planet of a lap of Space; it fits the lap whole when any planet not yet shown does (on the logical screen width). */
export function lapPlanet(planetSeed: number, lap: number): SpacePlanetId {
  let walk = walks.get(planetSeed);
  if (!walk) {
    if (walks.size >= MAX_WALKS) walks.clear();
    walk = new PlanetWalk(
      planetSeed,
      (id, at) => planetFit(at, LOGICAL_SIZE.width, planetSize(id).width, 0) !== null,
    );
    walks.set(planetSeed, walk);
  }
  return walk.pick(lap);
}

/**
 * Height of the centre of a planet that has crossed `progress` (0..1) of its way: from `half` above the top edge
 * (further up by `enter` 0..1 of `PLANET_PLACE.enterVary` of the screen) to `half` below the bottom edge, `half` being
 * the half height of the picture with its drift. Linear in the progress, so the planet keeps the pace of the scroll.
 */
export function planetY(progress: number, screenH: number, half: number, enter: number): number {
  const start = -half - enter * PLANET_PLACE.enterVary * screenH;
  const end = screenH + half;
  return start + (end - start) * progress;
}

/**
 * How muted the planet at height `y` with the half height `halfH` (its drift included) is: 1 while any part of it
 * overlaps the stripe of the flying layer (`flightClearBand`), falling to 0 over `PLANET_DIM.featherPx` away from it.
 */
export function planetMute(y: number, halfH: number, screenH: number): number {
  const band = flightClearBand(screenH);
  const gap = Math.max(band.top - (y + halfH), y - halfH - band.bottom);
  return 1 - clamp01(gap / PLANET_DIM.featherPx);
}
