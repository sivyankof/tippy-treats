import { ANIM } from '../data/anim';
import { BALANCE } from '../data/balance';
import { FLIGHT_CLEAR } from '../data/flight-clear';
import { HUD_LAYOUT } from '../data/hud-layout';

/**
 * How far above the top of the tower the flying layer reaches: the gap it starts in, its own
 * height and the bob. The camera keeps this row below the HUD; hints keep out of it.
 */
export const FLYING_REACH =
  BALANCE.layer.gapAboveTower + BALANCE.layer.height + ANIM.flying.bobAmplitude;

/** Scroll that shows the tray (its top at world y `trayTopY`) low on a screen `screenH` tall. */
export function trayScrollY(trayTopY: number, screenH: number): number {
  return trayTopY - (screenH - ANIM.camera.trayBottomOffset);
}

/**
 * Scroll that keeps the tray low at the start and later shows as many layers as fit while the
 * whole flying layer (with its bob) stays below the HUD, counter chips of the badge row included. `towerTopY` is the world y of the top.
 */
export function targetScrollY(trayTopY: number, screenH: number, towerTopY: number): number {
  return Math.min(trayScrollY(trayTopY, screenH), towerTopY - surfaceScreenY(screenH));
}

/** Screen y the top of a tall tower stands at: the flying layer is above it, the HUD above that. */
export function surfaceScreenY(screenH: number): number {
  return Math.max(
    screenH - ANIM.camera.visibleLayers * BALANCE.layer.height,
    HUD_LAYOUT.badgeRowBottom + ANIM.camera.hudClearance + FLYING_REACH,
  );
}

/** The highest the top of a background picture may go: `FLIGHT_CLEAR.hudGapPx` under the lowest HUD plate. */
export function hudFloor(): number {
  return HUD_LAYOUT.badgeRowBottom + FLIGHT_CLEAR.hudGapPx;
}

/**
 * How visible a background picture centred at (`x`, `y`) with the given `radius` may be, with respect
 * to the HUD plates: 0 inside any plate grown by `FLIGHT_CLEAR.hudGapPx`, rising to 1 over `feather`
 * px outside it. Weather particles fade by it; stars and the like are not placed where it is 0.
 */
export function hudKeepOutFade(x: number, y: number, radius = 0, feather = 0): number {
  const gap = FLIGHT_CLEAR.hudGapPx + radius;
  let fade = 1;
  for (const plate of HUD_LAYOUT.plates) {
    const dx = Math.max(plate.x - x, 0, x - (plate.x + plate.width));
    const dy = Math.max(plate.y - y, 0, y - (plate.y + plate.height));
    const away = Math.hypot(dx, dy) - gap;
    if (away <= 0) return 0;
    if (feather > 0) fade = Math.min(fade, away / feather);
  }
  return Math.min(fade, 1);
}

/**
 * The stripe the background satellite and comet keep out of: the flight stripe stretched down past
 * the top of the tower (`FLIGHT_CLEAR.travellerBelowTopPx`), and a ceiling `hudGapPx` under the
 * lowest HUD plate.
 */
export function travellerClearBand(screenH: number): {
  top: number;
  bottom: number;
  ceiling: number;
} {
  const band = flightClearBand(screenH);
  return {
    top: band.top,
    bottom: Math.max(band.bottom, surfaceScreenY(screenH) + FLIGHT_CLEAR.travellerBelowTopPx),
    ceiling: hudFloor(),
  };
}

/**
 * The stripe of the screen the background travellers keep out of: the line of the incoming layer
 * (its centre when the tower top stands at `surfaceScreenY`) and `aroundLayers` layer heights
 * above and below it. Space only, where the tower is always tall, so the row stands still.
 */
export function flightClearBand(screenH: number): { top: number; bottom: number } {
  const { gapAboveTower, height } = BALANCE.layer;
  const centre = surfaceScreenY(screenH) - gapAboveTower - height / 2;
  const reach = height * FLIGHT_CLEAR.aroundLayers;
  return { top: centre - reach, bottom: centre + reach };
}
