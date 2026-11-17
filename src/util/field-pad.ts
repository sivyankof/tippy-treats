/**
 * Room added around a drawing so its outline and tips fit the picture (docs/06 section 1,
 * "Поле картинки"): the drawing keeps its place, the picture grows by the pad on each side.
 */

/** Room on each side, px. */
export interface SidePads {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The same room on every side. */
export function evenPads(pad: number): SidePads {
  return { left: pad, right: pad, top: pad, bottom: pad };
}

/** The size of a picture whose field grew by `pad` px (a number pads every side alike). */
export function paddedSize(
  width: number,
  height: number,
  pad: number | SidePads,
): [number, number] {
  const p = typeof pad === 'number' ? evenPads(pad) : pad;
  return [width + p.left + p.right, height + p.top + p.bottom];
}

/** How many times bigger a square picture of `size` px gets when its field grows by `pad` px on every side: show it this much bigger to keep the drawing at its size. */
export function paddedScale(size: number, pad: number): number {
  return (size + pad * 2) / size;
}

/**
 * The origin (0..1) of the grown picture that holds the same spot of the drawing as `origin` held
 * in the picture of `width` x `height` (a number pads every side alike).
 */
export function paddedOrigin(
  origin: readonly [number, number],
  width: number,
  height: number,
  pad: number | SidePads,
): [number, number] {
  const p = typeof pad === 'number' ? evenPads(pad) : pad;
  const [w, h] = paddedSize(width, height, p);
  return [(origin[0] * width + p.left) / w, (origin[1] * height + p.top) / h];
}
