import { CLIP_ALPHA_THRESHOLD, type ClipSide } from '../data/clip-guard';

/** How many noticeably opaque pixels lie beyond each side of a field. */
export type EdgeCounts = Record<ClipSide, number>;

/** What lies beyond one side of a field: the opaque pixels and how far the farthest one is from the field. */
export interface Overflow {
  pixels: number;
  reach: number;
  /** Free pixels between the field edge and the nearest opaque pixel; negative when the drawing runs past the edge. */
  spare: number;
}

export type OverflowBySide = Record<ClipSide, Overflow>;

/**
 * Measures the pixels with alpha above `threshold` in the margin of `pad` pixels around a field:
 * `data` is a (`width` + 2 `pad`) x (`height` + 2 `pad`) picture with the field in the middle. The
 * pixels of a side are the ones in the strip beside that side (corners belong to no side).
 */
export function measureOverflow(
  data: ArrayLike<number>,
  width: number,
  height: number,
  pad: number,
  threshold: number = CLIP_ALPHA_THRESHOLD,
): OverflowBySide {
  const total = width + pad * 2;
  const out: OverflowBySide = {
    top: { pixels: 0, reach: 0, spare: Infinity },
    right: { pixels: 0, reach: 0, spare: Infinity },
    bottom: { pixels: 0, reach: 0, spare: Infinity },
    left: { pixels: 0, reach: 0, spare: Infinity },
  };
  const opaque = (x: number, y: number): boolean =>
    (data[(y * total + x) * 4 + 3] ?? 0) > threshold;
  const mark = (side: ClipSide, reach: number): void => {
    out[side].pixels++;
    out[side].reach = Math.max(out[side].reach, reach);
  };
  // The nearest opaque pixel to each field edge, anywhere in the padded picture.
  const rows = height + pad * 2;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < total; x++) {
      if (!opaque(x, y)) continue;
      out.top.spare = Math.min(out.top.spare, y - pad);
      out.bottom.spare = Math.min(out.bottom.spare, pad + height - 1 - y);
      out.left.spare = Math.min(out.left.spare, x - pad);
      out.right.spare = Math.min(out.right.spare, pad + width - 1 - x);
    }
  }
  for (let x = pad; x < pad + width; x++) {
    for (let y = 0; y < pad; y++) if (opaque(x, y)) mark('top', pad - y);
    for (let y = pad + height; y < height + pad * 2; y++) {
      if (opaque(x, y)) mark('bottom', y - pad - height + 1);
    }
  }
  for (let y = pad; y < pad + height; y++) {
    for (let x = 0; x < pad; x++) if (opaque(x, y)) mark('left', pad - x);
    for (let x = pad + width; x < total; x++) if (opaque(x, y)) mark('right', x - pad - width + 1);
  }
  return out;
}
