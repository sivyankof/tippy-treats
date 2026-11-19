/**
 * The GL texture wrappers a call left behind: in `after` and not in `before`, and not one of
 * `kept` (the textures the new object holds).
 *
 * Phaser 4.2.1 `DynamicTexture` makes a blank texture of its full size for its source
 * (`TextureSource.init`), then points the source at the texture of its drawing context instead
 * and never deletes the first one. It stays in the renderer's list until the game ends: GPU
 * memory of a whole picture per dynamic texture made (docs/08, journal 2026-11-19).
 */
export function strayTextures<T>(
  before: readonly T[],
  after: readonly T[],
  kept: readonly (T | null | undefined)[],
): T[] {
  const old = new Set(before);
  const keep = new Set(kept);
  return after.filter((wrapper) => !old.has(wrapper) && !keep.has(wrapper));
}
