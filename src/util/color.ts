const CHANNEL_MAX = 255;

function channels(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

function pack(r: number, g: number, b: number): number {
  const clamp = (v: number): number => Math.min(CHANNEL_MAX, Math.max(0, Math.round(v)));
  return (clamp(r) << 16) | (clamp(g) << 8) | clamp(b);
}

/** Linear blend of two 0xRRGGBB colours, `t` in 0..1. */
export function mixColor(from: number, to: number, t: number): number {
  const [r1, g1, b1] = channels(from);
  const [r2, g2, b2] = channels(to);
  return pack(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** CSS colour string for Phaser text styles. */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Darkens (negative amount) or lightens (positive amount) a colour by 0..1. */
export function shade(color: number, amount: number): number {
  return amount < 0 ? mixColor(color, 0x000000, -amount) : mixColor(color, 0xffffff, amount);
}
