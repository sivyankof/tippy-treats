/** Where and how big a layer picture sits in a square icon. */
export interface IconPlacement {
  scale: number;
  x: number;
  y: number;
}

/**
 * Fits a picture `width` wide that reaches `above` over the layer centre and `below` under it
 * into a square of side `size`, centred, with a margin of `marginShare` of the side.
 */
export function iconPlacement(
  width: number,
  above: number,
  below: number,
  size: number,
  marginShare: number,
): IconPlacement {
  const room = size * (1 - marginShare * 2);
  const scale = Math.min(room / width, room / (above + below));
  return { scale, x: size / 2, y: size / 2 + ((above - below) / 2) * scale };
}
