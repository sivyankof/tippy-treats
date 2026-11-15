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
