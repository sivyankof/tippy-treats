import { ANIM } from '../../data/common/anim';
import { BALANCE } from '../../data/tower/balance';
import { FLIGHT_CLEAR } from '../../data/backdrop/flight-clear';
import { HUD_LAYOUT } from '../../data/run/hud-layout';
import { safeBand } from '../app/safe-area';

/**
 * How far above the top of the tower the flying layer reaches: the gap it starts in, its own
 * height and the bob. The camera keeps this row below the HUD; hints keep out of it.
 */
export const FLYING_REACH =
  BALANCE.layer.gapAboveTower + BALANCE.layer.height + ANIM.flying.bobAmplitude;

/**
 * The run HUD is laid out as if the safe band started at y 0 and the canvas moved down by the top
 * inset (the HUD scene scrolls by it). These give its places in canvas coordinates, which is what
 * the world and the background work in: with no insets they are the HUD coordinates themselves.
 */
export function hudTopShift(): number {
  return safeBand().top;
}

/** Canvas y of the lowest HUD edge (height, score, wobble bar, badge row). */
export function hudBottomEdgeY(): number {
  return HUD_LAYOUT.bottomEdge + safeBand().top;
}

/** Canvas y of the lowest HUD edge including the counter chips under the badges. */
export function hudBadgeRowBottomY(): number {
  return HUD_LAYOUT.badgeRowBottom + safeBand().top;
}

/** Canvas y of the top of the wobble plate. */
export function hudWobblePlateY(): number {
  return HUD_LAYOUT.wobblePlate.y + safeBand().top;
}

type HudPlate = (typeof HUD_LAYOUT.plates)[number];
let shiftedPlates: { top: number; plates: readonly HudPlate[] } | null = null;

/** The HUD plates in canvas coordinates (cached per top inset: no allocation per frame). */
export function hudPlates(): readonly HudPlate[] {
  const top = safeBand().top;
  if (top === 0) return HUD_LAYOUT.plates;
  if (shiftedPlates?.top !== top) {
    shiftedPlates = { top, plates: HUD_LAYOUT.plates.map((p) => ({ ...p, y: p.y + top })) };
  }
  return shiftedPlates.plates;
}

/**
 * Scroll that shows the tray (its top at world y `trayTopY`) low on a screen `screenH` tall: the
 * tray keeps `trayBottomOffset` px above the bottom safe edge.
 */
export function trayScrollY(trayTopY: number, screenH: number): number {
  return trayTopY - (screenH - safeBand().bottom - ANIM.camera.trayBottomOffset);
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
    screenH - safeBand().bottom - ANIM.camera.visibleLayers * BALANCE.layer.height,
    hudBadgeRowBottomY() + ANIM.camera.hudClearance + FLYING_REACH,
  );
}

/** The highest the top of a background picture may go: `FLIGHT_CLEAR.hudGapPx` under the lowest HUD plate. */
export function hudFloor(): number {
  return hudBadgeRowBottomY() + FLIGHT_CLEAR.hudGapPx;
}

/**
 * How visible a background picture centred at (`x`, `y`) with the given `radius` may be, with respect
 * to the HUD plates: 0 inside any plate grown by `FLIGHT_CLEAR.hudGapPx`, rising to 1 over `feather`
 * px outside it. Weather particles fade by it; stars and the like are not placed where it is 0.
 */
export function hudKeepOutFade(x: number, y: number, radius = 0, feather = 0): number {
  const gap = FLIGHT_CLEAR.hudGapPx + radius;
  let fade = 1;
  for (const plate of hudPlates()) {
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
