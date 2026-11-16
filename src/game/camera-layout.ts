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
