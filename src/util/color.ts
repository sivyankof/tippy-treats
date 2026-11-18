const CHANNEL_MAX = 255;

/** Red, green and blue (0..255) of a 0xRRGGBB colour. */
export function channels(color: number): [number, number, number] {
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

/** Channel-wise product of two 0xRRGGBB colours (what a multiply tint does). */
export function multiplyColor(a: number, b: number): number {
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  return pack((r1 * r2) / CHANNEL_MAX, (g1 * g2) / CHANNEL_MAX, (b1 * b2) / CHANNEL_MAX);
}

/** CSS colour string for Phaser text styles. */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Darkens (negative amount) or lightens (positive amount) a colour by 0..1. */
export function shade(color: number, amount: number): number {
  return amount < 0 ? mixColor(color, 0x000000, -amount) : mixColor(color, 0xffffff, amount);
}

function linearChannel(value: number): number {
  const v = value / CHANNEL_MAX;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Perceived brightness of a 0xRRGGBB colour on the gamma-encoded channels (Rec. 601 weights), 0..1. */
export function luma(color: number): number {
  const [r, g, b] = channels(color);
  return (0.299 * r + 0.587 * g + 0.114 * b) / CHANNEL_MAX;
}

/** Relative luminance (WCAG) of a 0xRRGGBB colour, 0..1. */
export function luminance(color: number): number {
  const [r, g, b] = channels(color);
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

/** WCAG contrast ratio of two colours, 1..21. */
export function contrastRatio(a: number, b: number): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** 0xRRGGBB number of a `#rrggbb` string (the form colours have in data files). */
export function parseHex(css: string): number {
  return Number.parseInt(css.replace('#', ''), 16);
}

/** Hue (0..1), saturation (0..1) and lightness (0..1) of a 0xRRGGBB colour. */
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function toHsl(color: number): Hsl {
  const [r8, g8, b8] = channels(color);
  const r = r8 / CHANNEL_MAX;
  const g = g8 / CHANNEL_MAX;
  const b = b8 / CHANNEL_MAX;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h / 6, s, l };
}

function hueChannel(p: number, q: number, t: number): number {
  const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
  if (u < 1 / 6) return p + (q - p) * 6 * u;
  if (u < 1 / 2) return q;
  if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
  return p;
}

/** The 0xRRGGBB colour of a hue, saturation and lightness (each 0..1). */
export function fromHsl({ h, s, l }: Hsl): number {
  if (s === 0) return pack(l * CHANNEL_MAX, l * CHANNEL_MAX, l * CHANNEL_MAX);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return pack(
    hueChannel(p, q, h + 1 / 3) * CHANNEL_MAX,
    hueChannel(p, q, h) * CHANNEL_MAX,
    hueChannel(p, q, h - 1 / 3) * CHANNEL_MAX,
  );
}

/** Rec. 601 weights of the red, green and blue channels in `luma`. */
const LUMA_R = 0.299;
const LUMA_G = 0.587;
const LUMA_B = 0.114;
/** Bytes per pixel of RGBA image data. */
const RGBA = 4;

/**
 * Mutes RGBA pixels in place: each colour keeps `saturation` (0..1) of its distance from its own grey (Rec. 601
 * luma), then is scaled by `brightness` (0..1). Alpha is left as it is.
 */
export function dimPixels(data: Uint8ClampedArray, saturation: number, brightness: number): void {
  for (let i = 0; i < data.length; i += RGBA) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const grey = LUMA_R * r + LUMA_G * g + LUMA_B * b;
    data[i] = (grey + (r - grey) * saturation) * brightness;
    data[i + 1] = (grey + (g - grey) * saturation) * brightness;
    data[i + 2] = (grey + (b - grey) * saturation) * brightness;
  }
}

/** The overlay tint of the renderer: `tint` laid over a picture pixel `base`, channel by channel (mid grey gives the tint, white stays white). */
export function overlayColor(base: number, tint: number): number {
  const b = channels(base);
  const t = channels(tint);
  const out = b.map((v, i) => {
    const x = v / CHANNEL_MAX;
    const k = t[i]! / CHANNEL_MAX;
    return CHANNEL_MAX * (x < 0.5 ? 2 * k * x : 1 - 2 * (1 - k) * (1 - x));
  });
  return pack(out[0]!, out[1]!, out[2]!);
}
