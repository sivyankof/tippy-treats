import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';

/**
 * Shrinks a one-line text to fit `maxWidth`, down to `MENU.text.minFitScale` of its size
 * (docs/07-ui-screens.md: long Russian labels shrink rather than wrap). Returns the text.
 */
export function fitText<T extends Phaser.GameObjects.Text>(text: T, maxWidth: number): T {
  text.setScale(1);
  if (text.width <= maxWidth || text.width === 0) return text;
  text.setScale(Math.max(MENU.text.minFitScale, maxWidth / text.width));
  return text;
}
