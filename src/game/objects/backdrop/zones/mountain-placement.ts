import { BALANCE } from '../../../../data/tower/balance';
import { MOUNTAIN_SPAN } from '../../../../data/backdrop/backdrop-mountains';
import { smoothstep } from '../../../../util/math';

/**
 * How far the mountain peaks have risen at a tower height: 0 hidden below the screen edge, 1 fully
 * up. They rise at the end of the roof zone, stand while the clouds begin and sink away.
 */
export function mountainRise(layers: number): number {
  const { riseFrom, riseTo, sinkFrom, sinkTo } = MOUNTAIN_SPAN;
  if (layers <= riseFrom || layers >= sinkTo) return 0;
  if (layers < riseTo) return smoothstep((layers - riseFrom) / (riseTo - riseFrom));
  if (layers <= sinkFrom) return 1;
  return smoothstep((sinkTo - layers) / (sinkTo - sinkFrom));
}

/**
 * Tower height in layers from the camera scroll of a tall tower: the camera keeps the top at
 * `surfaceScreenY` on screen, and the empty tray top is at world y `trayTopY`.
 */
export function towerLayersAt(scrollY: number, trayTopY: number, surfaceScreenY: number): number {
  return Math.max(0, (trayTopY - (scrollY + surfaceScreenY)) / BALANCE.layer.height);
}
