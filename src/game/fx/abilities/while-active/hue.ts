const CHANNEL_MAX = 255;
const SECTORS = 6;

/** 0xRRGGBB of a hue (a turn is 1, any number works) at the given saturation and full brightness. */
export function hueColor(hue: number, saturation: number): number {
  const h = (((hue % 1) + 1) % 1) * SECTORS;
  const sector = Math.floor(h);
  const rise = h - sector;
  const low = 1 - saturation;
  const falling = 1 - saturation * rise;
  const rising = 1 - saturation * (1 - rise);
  const [r, g, b] = [
    [1, rising, low],
    [falling, 1, low],
    [low, 1, rising],
    [low, falling, 1],
    [rising, low, 1],
    [1, low, falling],
  ][sector % SECTORS] as [number, number, number];
  const byte = (v: number): number => Math.round(v * CHANNEL_MAX);
  return (byte(r) << 16) | (byte(g) << 8) | byte(b);
}
