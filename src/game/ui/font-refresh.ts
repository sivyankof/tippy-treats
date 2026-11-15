import * as Phaser from 'phaser';
import { runFontRefresh } from './menu/fit-text';

/** Every object under `objects`, containers opened. */
function collectObjects(
  objects: readonly Phaser.GameObjects.GameObject[],
  out: Phaser.GameObjects.GameObject[] = [],
): Phaser.GameObjects.GameObject[] {
  for (const object of objects) {
    out.push(object);
    if (object instanceof Phaser.GameObjects.Container) collectObjects(object.list, out);
  }
  return out;
}

/**
 * Phaser measures a Text (ascent, descent) once, with whatever font the browser has at that moment.
 * If the web font arrives after the first frame, the canvas keeps the fallback metrics and the real
 * glyphs come out cut at the top. When fonts finish loading, measure every live Text again and let
 * the scenes lay themselves out anew (they size plates and rows from `text.width`). Fitted texts
 * and rows that placed things by text widths re-fit through `onFontRefresh`, after every text is measured.
 */
export function refreshTextsOnFontLoad(game: Phaser.Game): void {
  document.fonts.addEventListener('loadingdone', () => {
    for (const scene of game.scene.getScenes(false)) {
      const objects = collectObjects(scene.children.list);
      for (const object of objects) {
        if (object instanceof Phaser.GameObjects.Text) object.style.update(true);
      }
      for (const object of objects) runFontRefresh(object);
    }
    // The same size again: the scenes' resize handlers are their layout code, and Phaser's own reads all arguments.
    const { gameSize, baseSize, displaySize } = game.scale;
    game.scale.emit(
      Phaser.Scale.Events.RESIZE,
      gameSize,
      baseSize,
      displaySize,
      gameSize.width,
      gameSize.height,
    );
  });
}
