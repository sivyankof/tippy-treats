import { WINDOW_LOOK, type WindowSky } from '../../../data/window-look';
import { cssColor } from '../../../util/color';
import { TWO_PI } from '../../../util/math';

import { outlineColor } from '../../fx/plain-style';

type Ctx2D = CanvasRenderingContext2D;

/** The glass of a window picture: where the sky is painted. */
export interface GlassBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The glass of the small window, the size the sky's details (moon, stars, clouds) are drawn for. */
const SMALL_GLASS = WINDOW_LOOK.glass;
const DETAIL_GROWTH = 0.8;

export function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A cloud of round lobes only (no flat base): bigger lobes in the middle, a low wide one under them. */
export function cloud(ctx: Ctx2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  for (const [dx, dy, r] of [
    [-28, 8, 14],
    [-10, -4, 20],
    [12, -2, 18],
    [30, 8, 13],
    [0, 10, 18],
  ] as const) {
    ctx.moveTo(x + (dx + r) * s, y + dy * s);
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, TWO_PI);
  }
  ctx.fill();
}

/** Scale of the moon, stars and clouds for a glass `h` px tall: 1 on the small window, never smaller on a bigger pane. */
export function detailScale(h: number): number {
  return Math.max(1, (h / SMALL_GLASS.h) * DETAIL_GROWTH);
}

/** The storm and rain clouds of a heavy sky: x as a share of the glass width, y as a share of its height, size. */
export const HEAVY_CLOUDS = [
  { x: 0.28, y: 0.12, s: 1.5 },
  { x: 0.76, y: 0.08, s: 1.7 },
  { x: 0.5, y: 0.24, s: 1.2 },
] as const;

/** Where the moon of a night sky stands in the glass (shares of its width and height) and its radius at detail scale 1. */
const MOON = { x: 0.68, y: 0.2, r: 17, rim: 2.5 } as const;

/** The moon of a night sky in `glass`: its centre and its outer radius (with the outline), in the glass's units. */
export function moonSpot(glass: GlassBox, mirror = false): { x: number; y: number; r: number } {
  const k = detailScale(glass.h);
  const share = mirror ? 1 - MOON.x : MOON.x;
  return {
    x: glass.x + glass.w * share,
    y: glass.y + glass.h * MOON.y,
    r: (MOON.r + MOON.rim) * k,
  };
}

/** A flat moon: a warm outline, a pale disc, a darker rim on the lower right and a gloss mark. No glow. */
export function paintMoon(ctx: Ctx2D, glass: GlassBox, mirror = false): void {
  const k = detailScale(glass.h);
  const { x: mx, y: my } = moonSpot(glass, mirror);
  const r = MOON.r * k;
  ctx.fillStyle = cssColor(0xb9904a);
  ctx.beginPath();
  ctx.arc(mx, my, r + MOON.rim * k, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = cssColor(0xf1d98a);
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = cssColor(0xfff1b8);
  ctx.beginPath();
  ctx.arc(mx - 2.5 * k, my - 2.5 * k, r - 4.5 * k, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.roundRect(mx - 9 * k, my - 8 * k, 4 * k, 9 * k, 2 * k);
  ctx.fill();
}

/**
 * `mirror` puts the sky's details on the left half (the shop window: its right half is against the tower). `withMoon`
 * false leaves the moon out (the panoramic window draws it as a picture of its own, `paintMoon`).
 */
export function paintSky(
  ctx: Ctx2D,
  sky: WindowSky,
  mirror: boolean,
  glass: GlassBox = SMALL_GLASS,
  withMoon = true,
): void {
  const { x, y, w, h } = glass;
  // Moon, stars and clouds grow with the glass, but a little less than it, so a wide pane does not get giant ones.
  const k = detailScale(h);
  const at = (share: number): number => x + w * (mirror ? 1 - share : share);
  const gradient = ctx.createLinearGradient(0, y, 0, y + h);
  gradient.addColorStop(0, cssColor(sky.top));
  gradient.addColorStop(1, cssColor(sky.bottom));
  ctx.fillStyle = gradient;
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  if (sky.stars) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [sx, sy, r0] of [
      [0.2, 0.14, 4],
      [0.62, 0.3, 3],
      [0.35, 0.46, 3],
      [0.8, 0.52, 4],
      [0.14, 0.7, 3],
    ] as const) {
      const r = r0 * k;
      const cx = at(sx);
      const cy = y + h * sy;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 2);
      ctx.lineTo(cx + r * 0.6, cy - r * 0.6);
      ctx.lineTo(cx + r * 2, cy);
      ctx.lineTo(cx + r * 0.6, cy + r * 0.6);
      ctx.lineTo(cx, cy + r * 2);
      ctx.lineTo(cx - r * 0.6, cy + r * 0.6);
      ctx.lineTo(cx - r * 2, cy);
      ctx.lineTo(cx - r * 0.6, cy - r * 0.6);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (sky.moon && withMoon) paintMoon(ctx, glass, mirror);
  if (sky.cloud !== null) {
    ctx.fillStyle = cssColor(sky.cloud);
    ctx.globalAlpha = 0.9;
    if (sky.heavy) {
      for (const c of HEAVY_CLOUDS) cloud(ctx, at(c.x), y + h * c.y, c.s * k);
    } else {
      cloud(ctx, at(0.32), y + h * 0.34, 1.1 * k);
      cloud(ctx, at(0.8), y + h * 0.16, 0.7 * k);
    }
    ctx.globalAlpha = 1;
  }
}

/** Slanted bands of light on the glass, clipped to it. */
export function paintGlints(ctx: Ctx2D, glass: GlassBox = SMALL_GLASS): void {
  const { x, y, w, h } = glass;
  for (const g of WINDOW_LOOK.glints) {
    ctx.fillStyle = `rgba(255,255,255,${g.alpha})`;
    const x0 = x + w * g.x;
    const bandW = w * g.w;
    const lean = h * g.lean;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + bandW, y);
    ctx.lineTo(x0 + bandW + lean, y + h);
    ctx.lineTo(x0 + lean, y + h);
    ctx.closePath();
    ctx.fill();
  }
}

/** A bar of the sash with the dark outline of its own colour. */
export function bar(ctx: Ctx2D, x: number, y: number, w: number, h: number, color: number): void {
  ctx.fillStyle = cssColor(outlineColor(color));
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = cssColor(color);
  ctx.fillRect(x, y, w, h);
}

/** Where the scalloped valance hangs: its box, how many scallops and the corner radius of its band. */
export interface ValanceBox {
  left: number;
  right: number;
  top: number;
  band: number;
  scallops: number;
  radius: number;
}

/** A scalloped cloth over the top of the kitchen window: outline, cream body, every other scallop striped, a gloss mark. */
export function paintValance(ctx: Ctx2D, box: ValanceBox): void {
  const look = WINDOW_LOOK.colors.kitchen;
  const { left, right, top, band, scallops, radius } = box;
  const step = (right - left) / scallops;
  const edge = Math.max(3, band / 7);
  for (const [grow, color] of [
    [edge, look.valanceOutline],
    [0, look.valance],
  ] as const) {
    ctx.fillStyle = cssColor(color);
    roundRect(ctx, left - grow, top - grow, right - left + 2 * grow, band + 2 * grow, radius);
    ctx.fill();
    for (let i = 0; i < scallops; i++) {
      ctx.beginPath();
      ctx.arc(left + step * (i + 0.5), top + band, step / 2 + grow, 0, TWO_PI);
      ctx.fill();
    }
  }
  ctx.fillStyle = cssColor(look.valanceStripe);
  const inset = edge * 0.7;
  for (let i = 0; i < scallops; i += 2) {
    ctx.beginPath();
    ctx.arc(left + step * (i + 0.5), top + band, step / 2 - inset, 0, TWO_PI);
    ctx.fill();
    ctx.fillRect(left + step * i + inset, top + inset, step - 2 * inset, band - inset);
  }
  roundRect(ctx, left + step * 0.4, top + band * 0.18, step * 1.2, band * 0.18, band * 0.09);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
}
