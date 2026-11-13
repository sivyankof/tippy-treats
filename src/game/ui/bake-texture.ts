import type * as Phaser from 'phaser';

/**
 * Draws with a hidden Graphics once and stores the result as a texture.
 * Does nothing when the key already exists. Sizes are rounded up to whole pixels.
 * (0, 0) of the texture is its top-left corner; use translateCanvas to move the origin.
 */
export function bakeTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics().setVisible(false);
  try {
    draw(g);
    g.generateTexture(key, Math.ceil(width), Math.ceil(height));
  } finally {
    g.destroy();
  }
}
