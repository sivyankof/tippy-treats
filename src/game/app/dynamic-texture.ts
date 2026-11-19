import type * as Phaser from 'phaser';
import { strayTextures } from './stray-textures';
import { asWebGLRenderer } from './webgl-renderer';

/**
 * `textures.addDynamicTexture` without the blank GPU texture Phaser 4.2.1 leaves behind for every
 * dynamic texture (see `strayTextures`). Every dynamic texture of the game is made through here.
 */
export function addDynamicTexture(
  textures: Phaser.Textures.TextureManager,
  key: string,
  width: number,
  height: number,
): Phaser.Textures.DynamicTexture | null {
  // Phaser builds a texture for an invalid key before refusing it; a taken key it refuses at once.
  if (!key || textures.exists(key)) return null;
  const renderer = asWebGLRenderer(textures.game.renderer);
  const before = renderer ? [...renderer.glTextureWrappers] : [];
  const texture = textures.addDynamicTexture(key, width, height);
  if (!renderer || !texture) return texture;
  const kept = [
    texture.drawingContext.texture,
    ...texture.source.map((source) => source.glTexture),
  ];
  for (const stray of strayTextures(before, renderer.glTextureWrappers, kept)) {
    // No texture unit may keep pointing at a deleted texture (its `webGLTexture` turns null).
    renderer.glTextureUnits.unbindTexture(stray);
    renderer.deleteTexture(stray);
  }
  return texture;
}
