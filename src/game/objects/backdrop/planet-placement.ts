import { spaceWidthLimit, lapFirstIndex } from '../../../core/space-laps';
import { LOGICAL_SIZE } from '../../../data/screen';
import { PLANET_PLACE } from '../../../data/space-planets';
import { flightClearBand, hudFloor } from '../../camera-layout';

/** Where the centre of a planet hangs, before its drift. */
export interface PlanetSpot {
  x: number;
  y: number;
}

/** A spot and the scale the planet is shown at there. */
export interface PlanetFit extends PlanetSpot {
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
 * Centre of the planet of a lap on a screen `screenW` x `screenH`, for a picture `width` x
 * `height` already scaled; `null` when it has no room. The planet stays below the HUD, clear of the
 * stripe around the flying layer's line (`flightClearBand`, plus `rowGap`) and clear of the dashed
 * lap corridor (the lines run from the tower top up to the top of that stripe, on both sides). It may hang off the screen edge, but at least
 * `minVisible` of its width stays in view.
 */
export function planetSpot(
  lap: number,
  screenW: number,
  screenH: number,
  width: number,
  height: number,
  topWidth?: number,
): PlanetSpot | null {
  const { y: preferY, lineGap, minVisible, drift, rowGap } = PLANET_PLACE;
  const clear = flightClearBand(screenH);
  const bob = drift.bob.px;
  const hang = width * (minVisible - HALF);
  const preferLeft = screenW * PLANET_PLACE.x;
  // Above the flight row: under the HUD, clear of the stripe around the flying layer's line; any x
  // (the dashed lines start at the top of that stripe).
  const high = hudFloor() + bob + height / 2;
  const roof = clear.top - rowGap - bob - height / 2;
  if (high <= roof) {
    const y = Math.min(Math.max(preferY * screenH, high), roof);
    return { x: Math.min(Math.max(preferLeft, hang), screenW - hang), y };
  }
  // Below the stripe, beside the tower top: only in a free lane outside the dashed corridor.
  const y = clear.bottom + rowGap + bob + height / 2;
  if (y > screenH - height / 2) return null;
  const half = corridorHalf(lap, topWidth);
  const centre = LOGICAL_SIZE.width / 2;
  const lanes: readonly { lo: number; hi: number; prefer: number }[] = [
    { lo: hang, hi: centre - half - lineGap - width / 2, prefer: preferLeft },
    { lo: centre + half + lineGap + width / 2, hi: screenW - hang, prefer: screenW - preferLeft },
  ];
  for (const lane of lanes) {
    if (lane.lo <= lane.hi) return { x: Math.min(Math.max(lane.prefer, lane.lo), lane.hi), y };
  }
  return null;
}

/**
 * The spot of the planet of a lap at the largest scale from `PLANET_PLACE.scale` down to
 * `minScale` (in `scaleStep` steps) that has room; `width` x `height` is the unscaled picture and
 * `topWidth` the tower top width captured when lap 1 began (see `corridorHalf`).
 * `null` when it has no room even at `minScale`.
 */
export function planetFit(
  lap: number,
  screenW: number,
  screenH: number,
  width: number,
  height: number,
  topWidth?: number,
): PlanetFit | null {
  const { scale, minScale, scaleStep } = PLANET_PLACE;
  // A misconfigured ladder (min above the scale, no step) tries the scale alone.
  const span = (scale - minScale) / scaleStep;
  const steps = Number.isFinite(span) && span > 0 ? Math.round(span) : 0;
  for (let i = 0; i <= steps; i++) {
    const k = scale - i * scaleStep;
    const spot = planetSpot(lap, screenW, screenH, width * k, height * k, topWidth);
    if (spot) return { ...spot, scale: k };
  }
  return null;
}
