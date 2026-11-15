import * as Phaser from 'phaser';

/** Every Text under `objects`, containers included. */
function collectTexts(
  objects: readonly Phaser.GameObjects.GameObject[],
  out: Phaser.GameObjects.Text[] = [],
): Phaser.GameObjects.Text[] {
  for (const object of objects) {
    if (object instanceof Phaser.GameObjects.Text) out.push(object);
    else if (object instanceof Phaser.GameObjects.Container) collectTexts(object.list, out);
  }
  return out;
}

/**
 * Phaser measures a Text (ascent, descent) once, with whatever font the browser has at that moment.
 * If the web font arrives after the first frame, the canvas keeps the fallback metrics and the real
 * glyphs come out cut at the top. When fonts finish loading, measure every live Text again and let
 * the scenes lay themselves out anew (they size plates and rows from `text.width`).
 */
export function refreshTextsOnFontLoad(game: Phaser.Game): void {
  document.fonts.addEventListener('loadingdone', () => {
    for (const scene of game.scene.getScenes(false)) {
      for (const text of collectTexts(scene.children.list)) text.style.update(true);
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
