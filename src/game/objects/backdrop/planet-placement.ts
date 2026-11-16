import { spaceWidthLimit, lapFirstIndex } from '../../../core/space-laps';
import { HUD_LAYOUT } from '../../../data/hud-layout';
import { LAP_EDGE, LAP_EDGE_HEIGHT } from '../../../data/lap-edge';
import { LOGICAL_SIZE } from '../../../data/screen';
import { PLANET_PLACE } from '../../../data/space-planets';
import { surfaceScreenY } from '../../camera-layout';

/** Where the centre of a planet hangs, before its drift. */
export interface PlanetSpot {
  x: number;
  y: number;
}

/** Half of a picture: its centre to its edge. */
const HALF = 0.5;

/** Half width of the dashed corridor of a lap, swing of the top layer included; 0 where the lap shows no dashes. */
export function corridorHalf(lap: number): number {
  if (lap < LAP_EDGE.firstLap) return 0;
  return spaceWidthLimit(lapFirstIndex(lap)) / 2 + PLANET_PLACE.swayPx;
}

/**
 * Centre of the planet of a lap on a screen `screenW` x `screenH`, for a picture `width` x
 * `height` already scaled; `null` when it has no room. The planet stays clear of the dashed lap
 * corridor (the lines run from the tower top up past the flying row, `LAP_EDGE_HEIGHT` tall, on
 * both sides of the tower) and below the HUD. It may hang off the screen edge, but at least
 * `minVisible` of its width stays in view.
 */
export function planetSpot(
  lap: number,
  screenW: number,
  screenH: number,
  width: number,
  height: number,
): PlanetSpot | null {
  const { y: preferY, hudGap, lineGap, minVisible, drift } = PLANET_PLACE;
  const top = HUD_LAYOUT.badgeRowBottom + hudGap + drift.bob.px + height / 2;
  const lowest = screenH - height / 2;
  if (top > lowest) return null;
  const y = Math.min(Math.max(preferY * screenH, top), lowest);
  const half = corridorHalf(lap);
  const centre = LOGICAL_SIZE.width / 2;
  const hang = width * (minVisible - HALF);
  const preferLeft = screenW * PLANET_PLACE.x;
  const lanes: readonly { lo: number; hi: number; prefer: number }[] = [
    { lo: hang, hi: centre - half - lineGap - width / 2, prefer: preferLeft },
    {
      lo: centre + half + lineGap + width / 2,
      hi: screenW - hang,
      prefer: screenW - preferLeft,
    },
  ];
  for (const lane of lanes) {
    if (lane.lo <= lane.hi) return { x: Math.min(Math.max(lane.prefer, lane.lo), lane.hi), y };
  }
  // Above the corridor: only where the lines start low enough to leave a band under the HUD.
  const corridorTop = surfaceScreenY(screenH) - LAP_EDGE_HEIGHT;
  if (half > 0 && y + height / 2 <= corridorTop - lineGap) {
    return { x: Math.min(Math.max(preferLeft, hang), screenW - hang), y };
  }
  return null;
}
