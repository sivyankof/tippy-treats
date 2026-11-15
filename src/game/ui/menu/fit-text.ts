import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';

const REFRESH_KEY = 'fontRefresh';

/** Remembers how to lay `object` out again once the web font has changed what its texts measure. */
export function onFontRefresh(object: Phaser.GameObjects.GameObject, layout: () => void): void {
  object.setData(REFRESH_KEY, layout);
}

/** Runs the layout `object` registered with `onFontRefresh`, if any. */
export function runFontRefresh(object: Phaser.GameObjects.GameObject): void {
  const layout: unknown = object.getData(REFRESH_KEY);
  if (typeof layout === 'function') layout();
}

/**
 * Shrinks a one-line text to fit `maxWidth`, down to `MENU.text.minFitScale` of its size
 * (docs/07-ui-screens.md: long Russian labels shrink rather than wrap). Returns the text. The
 * text fits itself again after a late font load (see `refreshTextsOnFontLoad`).
 */
export function fitText<T extends Phaser.GameObjects.Text>(text: T, maxWidth: number): T {
  onFontRefresh(text, () => fitText(text, maxWidth));
  text.setScale(1);
  if (text.width <= maxWidth || text.width === 0) return text;
  text.setScale(Math.max(MENU.text.minFitScale, maxWidth / text.width));
  return text;
}
