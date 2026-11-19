import type { ZoneId } from '../zones/zones';

/** One flat silhouette of the far plane, in tile pixels. `tone` indexes `BACKDROP_FAR.toneShares`. */
export type FarShape =
  | { kind: 'rect' | 'round'; x: number; y: number; w: number; h: number; tone: number }
  | { kind: 'roof'; x: number; y: number; w: number; h: number; tone: number }
  | { kind: 'circle' | 'star'; x: number; y: number; r: number; tone: number }
  | { kind: 'cloud'; x: number; y: number; scale: number; tone: number };

const rect = (x: number, y: number, w: number, h: number, tone: number): FarShape => ({
  kind: 'rect',
  x,
  y,
  w,
  h,
  tone,
});
const round = (x: number, y: number, w: number, h: number, tone: number): FarShape => ({
  kind: 'round',
  x,
  y,
  w,
  h,
  tone,
});
const roof = (x: number, y: number, w: number, h: number, tone: number): FarShape => ({
  kind: 'roof',
  x,
  y,
  w,
  h,
  tone,
});
const circle = (x: number, y: number, r: number, tone: number): FarShape => ({
  kind: 'circle',
  x,
  y,
  r,
  tone,
});
const star = (x: number, y: number, r: number, tone: number): FarShape => ({
  kind: 'star',
  x,
  y,
  r,
  tone,
});
const cloud = (x: number, y: number, scale: number, tone: number): FarShape => ({
  kind: 'cloud',
  x,
  y,
  scale,
  tone,
});

/**
 * The far plane behind every parallax layer (docs/06, "Дальний план"): paler flat
 * silhouettes of the zone's own objects in 2-3 tone steps close to the sky. Everything is
 * baked once; the frame only moves one picture.
 */
export const BACKDROP_FAR = {
  /** Side of the square silhouette tile. */
  tile: 512,
  /** The silhouettes are drawn this share of the way from the sky colour to `light`, per tone step. */
  toneShares: [0.15, 0.27, 0.39],
  /** Where on the sky gradient (0 top, 1 bottom) the base colour is taken. */
  skyAt: 0.55,
  /** Pale colour the silhouettes lean towards, per zone. */
  light: {
    kitchen: 0xfff1d6,
    showcase: 0xffffff,
    roof: 0xfff4e0,
    clouds: 0xffe3d0,
    stars: 0x8f9bff,
    space: 0x9a7fe0,
  } satisfies Record<ZoneId, number>,
  /**
   * The parallax layer the plane sits right above (-1: behind them all). Where the first layer is a
   * solid wall (kitchen, shop window) the plane goes on top of it, or it would never show.
   */
  slot: {
    kitchen: 1,
    showcase: 0,
    roof: -1,
    clouds: -1,
    stars: -1,
    space: -1,
  } satisfies Record<ZoneId, number>,
  /** The plane scrolls with this share of the camera (the nearest layer uses 0.6) and drifts slowly. */
  parallax: 0.02,
  driftPxPerSec: 1.5,
  alpha: 1,
  /** Silhouettes per zone on the square tile; the order is the drawing order (back to front). */
  shapes: {
    kitchen: [
      round(18, 30, 214, 176, 0),
      round(280, 30, 214, 176, 0),
      rect(0, 330, 512, 16, 1),
      round(38, 246, 96, 84, 2),
      rect(30, 236, 112, 14, 2),
      round(196, 270, 72, 60, 2),
      round(330, 254, 116, 76, 2),
      round(450, 272, 26, 40, 2),
      rect(0, 470, 512, 16, 1),
      round(84, 414, 62, 56, 2),
      round(300, 396, 90, 74, 2),
      round(420, 420, 50, 50, 2),
    ],
    showcase: [
      rect(24, 110, 196, 402, 0),
      rect(276, 200, 220, 312, 0),
      round(52, 170, 56, 84, 1),
      round(130, 170, 56, 84, 1),
      round(52, 300, 56, 84, 1),
      round(130, 300, 56, 84, 1),
      round(306, 260, 70, 90, 1),
      round(400, 260, 70, 90, 1),
      rect(0, 440, 512, 72, 2),
    ],
    roof: [
      rect(10, 250, 170, 262, 0),
      roof(0, 170, 190, 90, 0),
      rect(210, 330, 140, 182, 1),
      roof(200, 262, 160, 74, 1),
      rect(380, 280, 120, 232, 0),
      roof(372, 208, 136, 78, 0),
      rect(120, 150, 24, 60, 2),
      rect(430, 190, 22, 40, 2),
    ],
    clouds: [
      cloud(110, 120, 0.9, 0),
      cloud(390, 250, 1.2, 1),
      cloud(150, 400, 0.8, 2),
      cloud(420, 460, 0.6, 0),
    ],
    stars: [
      circle(400, 150, 24, 0),
      star(60, 90, 16, 1),
      star(200, 220, 12, 1),
      star(300, 60, 10, 2),
      star(470, 320, 14, 1),
      star(250, 440, 12, 2),
    ],
    space: [
      circle(430, 90, 26, 1),
      circle(120, 430, 28, 0),
      star(260, 250, 10, 1),
      star(330, 60, 8, 2),
    ],
  } satisfies Record<ZoneId, readonly FarShape[]>,
} as const;
