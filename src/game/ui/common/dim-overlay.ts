import type * as Phaser from 'phaser';
import { PALETTE } from '../../../data/common/palette';
import { watchVeil } from '../../app/status-bar';

/**
 * Full-screen dark veil. Resize it with `setSize`; call `setInteractive()` to catch taps. While it
 * dims the screen, the status bar icons turn light.
 */
export function createDimOverlay(
  scene: Phaser.Scene,
  alpha: number,
  width: number,
  height: number,
): Phaser.GameObjects.Rectangle {
  return watchVeil(scene.add.rectangle(0, 0, width, height, PALETTE.textDark, alpha).setOrigin(0));
}
