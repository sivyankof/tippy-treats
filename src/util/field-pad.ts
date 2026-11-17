/**
 * Room added around a drawing so its outline and tips fit the picture (docs/06 section 1,
 * "Поле картинки"): the drawing keeps its place, the picture grows by `pad` on every side.
 */

/** The size of a picture whose field grew by `pad` px on every side. */
export function paddedSize(width: number, height: number, pad: number): [number, number] {
  return [width + pad * 2, height + pad * 2];
}

/** The origin (0..1) of the grown picture that holds the same spot of the drawing as `origin` held in the picture of `width` x `height`. */
export function paddedOrigin(
  origin: readonly [number, number],
  width: number,
  height: number,
  pad: number,
): [number, number] {
  const [w, h] = paddedSize(width, height, pad);
  return [(origin[0] * width + pad) / w, (origin[1] * height + pad) / h];
}
