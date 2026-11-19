import * as Phaser from 'phaser';

/** Pins `object` (and the children of a container) to the canvas: it ignores the camera scroll. */
export function pinToCanvas(object: Phaser.GameObjects.GameObject): void {
  if ('setScrollFactor' in object && typeof object.setScrollFactor === 'function') {
    object.setScrollFactor(0);
  }
  if (object instanceof Phaser.GameObjects.Container) object.list.forEach(pinToCanvas);
}
