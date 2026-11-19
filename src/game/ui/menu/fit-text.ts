import type * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';

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
 * Shrinks a one-line text to fit `maxWidth` (and a wrapped one to fit `maxHeight` too, when
 * given), down to `MENU.text.minFitScale` of its size (docs/07-ui-screens.md: long Russian labels
 * shrink rather than wrap). Returns the text. The text fits itself again after a late font load
 * (see `refreshTextsOnFontLoad`).
 */
export function fitText<T extends Phaser.GameObjects.Text>(
  text: T,
  maxWidth: number,
  maxHeight = Infinity,
): T {
  onFontRefresh(text, () => fitText(text, maxWidth, maxHeight));
  text.setScale(1);
  if (text.width === 0) return text;
  const scale = Math.min(1, maxWidth / text.width, maxHeight / text.height);
  if (scale < 1) text.setScale(Math.max(MENU.text.minFitScale, scale));
  return text;
}
