import { CLIP_ALPHA_THRESHOLD, type ClipSide } from '../data/debug/clip-guard';

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
 * pixels of a side are the ones beyond that side; a pixel in a corner of the margin is beyond both sides that meet there and
 * counts for both, except that when one of them is in `allowed` (a side the picture may run past) it counts only for the allowed ones.
 */
export function measureOverflow(
  data: ArrayLike<number>,
  width: number,
  height: number,
  pad: number,
  threshold: number = CLIP_ALPHA_THRESHOLD,
  allowed: readonly ClipSide[] = [],
): OverflowBySide {
  const total = width + pad * 2;
  const rows = height + pad * 2;
  const out: OverflowBySide = {
    top: { pixels: 0, reach: 0, spare: Infinity },
    right: { pixels: 0, reach: 0, spare: Infinity },
    bottom: { pixels: 0, reach: 0, spare: Infinity },
    left: { pixels: 0, reach: 0, spare: Infinity },
  };
  const beyond: Array<[ClipSide, number]> = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < total; x++) {
      if ((data[(y * total + x) * 4 + 3] ?? 0) <= threshold) continue;
      // The nearest opaque pixel to each field edge, anywhere in the padded picture.
      out.top.spare = Math.min(out.top.spare, y - pad);
      out.bottom.spare = Math.min(out.bottom.spare, pad + height - 1 - y);
      out.left.spare = Math.min(out.left.spare, x - pad);
      out.right.spare = Math.min(out.right.spare, pad + width - 1 - x);
      // The sides this pixel is past, and by how much.
      beyond.length = 0;
      if (y < pad) beyond.push(['top', pad - y]);
      if (y >= pad + height) beyond.push(['bottom', y - pad - height + 1]);
      if (x < pad) beyond.push(['left', pad - x]);
      if (x >= pad + width) beyond.push(['right', x - pad - width + 1]);
      const free = beyond.some(([side]) => allowed.includes(side));
      for (const [side, reach] of beyond) {
        if (free && !allowed.includes(side)) continue;
        out[side].pixels++;
        out[side].reach = Math.max(out[side].reach, reach);
      }
    }
  }
  return out;
}
