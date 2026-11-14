import { ANIM } from '../data/anim';
import { BALANCE } from '../data/balance';
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
 * whole flying layer (with its bob) stays below the HUD. `towerTopY` is the world y of the top.
 */
export function targetScrollY(trayTopY: number, screenH: number, towerTopY: number): number {
  const surfaceScreenY = Math.max(
    screenH - ANIM.camera.visibleLayers * BALANCE.layer.height,
    HUD_LAYOUT.bottomEdge + ANIM.camera.hudClearance + FLYING_REACH,
  );
  return Math.min(trayScrollY(trayTopY, screenH), towerTopY - surfaceScreenY);
}
