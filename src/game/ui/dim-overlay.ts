import type * as Phaser from 'phaser';
import { PALETTE } from '../../data/palette';

/** Full-screen dark veil. Resize it with `setSize`; call `setInteractive()` to catch taps. */
export function createDimOverlay(
  scene: Phaser.Scene,
  alpha: number,
  width: number,
  height: number,
): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(0, 0, width, height, PALETTE.textDark, alpha).setOrigin(0);
}
