import * as Phaser from 'phaser';

function pin(object: Phaser.GameObjects.GameObject): void {
  if ('setScrollFactor' in object && typeof object.setScrollFactor === 'function') {
    object.setScrollFactor(0);
  }
  if (object instanceof Phaser.GameObjects.Container) object.list.forEach(pin);
}

/** A mark on the display list: `pinSince` pins what was added after it. */
export function displayMark(scene: Phaser.Scene): number {
  return scene.children.list.length;
}

/**
 * Pins what was added to the display list after `mark` (containers' children included) to the
 * canvas: it ignores the camera scroll. The run's scenes are laid out below the top inset, so
 * their camera scrolls by it; windows and veils that cover the canvas must not move with it.
 * Call it once the object is complete (parts added later are not pinned).
 */
export function pinSince(scene: Phaser.Scene, mark: number): void {
  scene.children.list.slice(mark).forEach(pin);
}

/** Runs `build` and pins everything it puts on the display list (`pinSince`). */
export function buildPinned<T>(scene: Phaser.Scene, build: () => T): T {
  const mark = displayMark(scene);
  const result = build();
  pinSince(scene, mark);
  return result;
}
