import { BALANCE } from '../../../data/tower/balance';
import type { SnapshotLayer } from '../../objects/tower/tower-snapshot';

/** Where the tower stands in the picture. */
export interface TowerFit {
  scale: number;
  /** World x that lands on the horizontal centre of the picture. */
  centerX: number;
  /** Where the tray's top surface rests: a short tower stands in the middle of the room, not on its floor. */
  trayY: number;
}

/** Room the tower gets in the picture. */
export interface TowerRoom {
  /** Width and height available, in picture pixels. */
  width: number;
  height: number;
  maxScale: number;
  /** The tray's position when the tower fills the whole height of the room. */
  bottom: number;
}

/**
 * The scale that makes the whole tower (tray included) fit into `room`, and the world x that
 * goes to the middle of the picture, and the height of the tray. Whatever room the tower leaves in
 * height is split above and below it. A short tower is enlarged to fill the room, up to `maxScale`.
 */
export function fitTower(layers: readonly SnapshotLayer[], room: TowerRoom): TowerFit {
  const trayHalf = BALANCE.tray.width / 2;
  let left = BALANCE.tray.centerX - trayHalf;
  let right = BALANCE.tray.centerX + trayHalf;
  for (const layer of layers) {
    left = Math.min(left, layer.x - layer.width / 2);
    right = Math.max(right, layer.x + layer.width / 2);
  }
  const towerHeight = Math.max(1, layers.length) * BALANCE.layer.height;
  const scale = Math.min(room.maxScale, room.width / (right - left), room.height / towerHeight);
  const spare = Math.max(0, room.height - towerHeight * scale);
  return { scale, centerX: (left + right) / 2, trayY: room.bottom - spare / 2 };
}
