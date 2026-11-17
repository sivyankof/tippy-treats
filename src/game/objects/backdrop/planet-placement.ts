import { spaceWidthLimit, lapFirstIndex } from '../../../core/space-laps';
import { PlanetWalk } from '../../../core/space-planet';
import { LOGICAL_SIZE } from '../../../data/screen';
import { PLANET_PLACE, type SpacePlanetId } from '../../../data/space-planets';
import { planetSize } from './dessert-planets';
import { clamp01 } from '../../../util/math';
import { flightClearBand, hudKeepOutFade } from '../../camera-layout';

/** The lane of a planet and the scale it is shown at there. */
export interface PlanetFit {
  x: number;
  scale: number;
}

/** Half of a picture: its centre to its edge. */
const HALF = 0.5;

/**
 * Half width of the corridor the planet keeps out of, swing of the top layer included. From lap 2
 * it is half the width cap of the lap (the dashed lines). Lap 1 has no lines: the corridor is the
 * tower top as it was when the lap was entered (`topWidth`); without it, the full layer width cap.
 */
export function corridorHalf(lap: number, topWidth?: number): number {
  const width =
    lap === 1 && topWidth !== undefined ? topWidth : spaceWidthLimit(lapFirstIndex(lap));
  return width / 2 + PLANET_PLACE.swayPx;
}

/**
 * Centre x of a planet `width` wide in its lane: on `side` (0 left, 1 right) of the lap corridor, at its preferred
 * distance from the screen edge, pushed into the lane; the planet may hang off the screen edge, but at least
 * `minVisible` of its width stays in view. `null` when the lane has no room.
 */
export function planetLaneX(
  lap: number,
  screenW: number,
  width: number,
  side: 0 | 1,
  topWidth?: number,
): number | null {
  const { lineGap, minVisible } = PLANET_PLACE;
  const hang = width * (minVisible - HALF);
  const half = corridorHalf(lap, topWidth);
  const centre = LOGICAL_SIZE.width / 2;
  const preferLeft = screenW * PLANET_PLACE.x;
  const lane =
    side === 0
      ? { lo: hang, hi: centre - half - lineGap - width / 2, prefer: preferLeft }
      : {
          lo: centre + half + lineGap + width / 2,
          hi: screenW - hang,
          prefer: screenW - preferLeft,
        };
  return lane.lo <= lane.hi ? Math.min(Math.max(lane.prefer, lane.lo), lane.hi) : null;
}

/**
 * The lane of the planet of a lap on `side` at the largest scale from `PLANET_PLACE.scale` down to
 * `minScale` (in `scaleStep` steps) that has room; `width` x `height` is the unscaled picture and
 * `topWidth` the tower top width captured when lap 1 began (see `corridorHalf`). The corridor is centred, so the two
 * lanes are as wide and the side does not change the scale. `null` when it has no room even at `minScale`.
 */
export function planetFit(
  lap: number,
  screenW: number,
  width: number,
  side: 0 | 1,
  topWidth?: number,
): PlanetFit | null {
  const { scale, minScale, scaleStep } = PLANET_PLACE;
  // A misconfigured ladder (min above the scale, no step) tries the scale alone.
  const span = (scale - minScale) / scaleStep;
  const steps = Number.isFinite(span) && span > 0 ? Math.round(span) : 0;
  for (let i = 0; i <= steps; i++) {
    const k = scale - i * scaleStep;
    const x = planetLaneX(lap, screenW, width * k, side, topWidth);
    if (x !== null) return { x, scale: k };
  }
  return null;
}

/** Walks kept per (seed, lap 1 top width): a lap change is one step of a walk, not a replay from lap 1. */
const walks = new Map<string, PlanetWalk>();
const MAX_WALKS = 8;

/**
 * The planet of a lap of Space on the logical screen width (the lanes of laps from 2 on depend on it alone), or
 * `null` when none fits. Only lap 1 depends on the tower top width, and that width is the one of lap 1 for EVERY lap
 * asked (the pick of lap 1 decides the picks after it): callers pass `lapOneTopWidth` (see `rememberLapOneWidth`).
 */
export function lapPlanet(
  planetSeed: number,
  lap: number,
  lapOneTopWidth?: number,
): SpacePlanetId | null {
  const key = `${planetSeed}|${lapOneTopWidth ?? ''}`;
  let walk = walks.get(key);
  if (!walk) {
    if (walks.size >= MAX_WALKS) walks.clear();
    walk = new PlanetWalk(
      planetSeed,
      (id, at) =>
        planetFit(
          at,
          LOGICAL_SIZE.width,
          planetSize(id).width,
          0,
          at === 1 ? lapOneTopWidth : undefined,
        ) !== null,
    );
    walks.set(key, walk);
  }
  return walk.pick(lap);
}

/**
 * The tower top width of lap 1, the one source of truth for the bakes and for the planet on screen: it is taken when
 * lap 1 begins and kept (`undefined` for a start deep in Space, in both places alike).
 */
export function rememberLapOneWidth(
  current: number | undefined,
  lap: number,
  topWidth: number | undefined,
): number | undefined {
  return lap === 1 ? topWidth : current;
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
 * How visible the planet is at (`x`, `y`) with the half height `halfH` and the half size `radius`: 0 while any part
 * of it is in the stripe of the flying layer (`flightClearBand`) plus `rowGap` or within the HUD gap of a plate,
 * rising to 1 over `fadeFeatherPx` past them. The half height counts the drift.
 */
export function planetFade(
  x: number,
  y: number,
  halfH: number,
  radius: number,
  screenH: number,
): number {
  const { rowGap, fadeFeatherPx } = PLANET_PLACE;
  const band = flightClearBand(screenH);
  const gap = Math.max(band.top - rowGap - (y + halfH), y - halfH - (band.bottom + rowGap));
  return Math.min(clamp01(gap / fadeFeatherPx), hudKeepOutFade(x, y, radius, fadeFeatherPx));
}
