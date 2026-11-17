import * as Phaser from 'phaser';
import {
  GLASS_LOOK,
  GLASS_TEX,
  GLASS_WEATHER,
  WINDOW_LOOK,
  WINDOW_SKY,
  windowKey,
  type GlassWeather,
  type WindowSky,
} from '../../../data/window-look';
import type { StartPlaceId } from '../../../data/start-places';
import type { WeatherId } from '../../../data/weather';
import { cssColor, shade } from '../../../util/color';
import { TWO_PI } from '../../../util/math';
import { effectsMode } from '../../effects-mode';
import { fillPolygon, outlineColor } from '../../fx/plain-style';
import { bakeTexture } from '../../ui/bake-texture';
import { glassPose, newGlassPose } from './glass-motion';
import type { FrameCtx, Life } from './life';

type Ctx2D = CanvasRenderingContext2D;

/** A stripe of the screen in logical px that the glass items keep out of (the row of the incoming layer, the HUD). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const W = WINDOW_LOOK.width;
const H = WINDOW_LOOK.height;
const GLASS = WINDOW_LOOK.glass;
const OUTLINE_PX = 4;

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A rectangle with a round top (an arched shop window). */
function archPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, bottom: number): void {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h - bottom);
  ctx.arcTo(x + w, y + h, x + w - bottom, y + h, bottom);
  ctx.lineTo(x + bottom, y + h);
  ctx.arcTo(x, y + h, x, y + h - bottom, bottom);
  ctx.closePath();
}

function glassPath(ctx: Ctx2D, place: StartPlaceId, grow = 0): void {
  const { x, y, w, h } = GLASS;
  if (place === 'shop') archPath(ctx, x - grow, y - grow, w + 2 * grow, h + 2 * grow, 10 + grow);
  else roundRect(ctx, x - grow, y - grow, w + 2 * grow, h + 2 * grow, 12 + grow);
}

function framePath(ctx: Ctx2D, place: StartPlaceId, grow: number): void {
  const { x, y, w, h } = GLASS;
  const pad = 16 + grow;
  if (place === 'shop') archPath(ctx, x - pad, y - pad, w + 2 * pad, h + 2 * pad, 18);
  else roundRect(ctx, x - pad, y - pad, w + 2 * pad, h + 2 * pad, 24);
}

/** A cloud of round lobes only (no flat base): bigger lobes in the middle, a low wide one under them. */
function cloud(ctx: Ctx2D, x: number, y: number, s: number): void {
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

/** `mirror` puts the sky's details on the left half (the shop window: its right half is against the tower). */
function paintSky(ctx: Ctx2D, sky: WindowSky, mirror: boolean): void {
  const { x, y, w, h } = GLASS;
  const at = (share: number): number => x + w * (mirror ? 1 - share : share);
  const gradient = ctx.createLinearGradient(0, y, 0, y + h);
  gradient.addColorStop(0, cssColor(sky.top));
  gradient.addColorStop(1, cssColor(sky.bottom));
  ctx.fillStyle = gradient;
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  if (sky.stars) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [sx, sy, r] of [
      [0.2, 0.14, 4],
      [0.62, 0.3, 3],
      [0.35, 0.46, 3],
      [0.8, 0.52, 4],
      [0.14, 0.7, 3],
    ] as const) {
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
  if (sky.moon) {
    const mx = at(0.68);
    const my = y + h * 0.2;
    const r = 17;
    // A flat moon: a warm outline, a pale disc, a darker rim on the lower right and a gloss mark. No glow.
    ctx.fillStyle = cssColor(0xb9904a);
    ctx.beginPath();
    ctx.arc(mx, my, r + 2.5, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = cssColor(0xf1d98a);
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = cssColor(0xfff1b8);
    ctx.beginPath();
    ctx.arc(mx - 2.5, my - 2.5, r - 4.5, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.roundRect(mx - 9, my - 8, 4, 9, 2);
    ctx.fill();
  }
  if (sky.cloud !== null) {
    ctx.fillStyle = cssColor(sky.cloud);
    ctx.globalAlpha = 0.9;
    if (sky.heavy) {
      cloud(ctx, at(0.28), y + h * 0.12, 1.5);
      cloud(ctx, at(0.76), y + h * 0.08, 1.7);
      cloud(ctx, at(0.5), y + h * 0.24, 1.2);
    } else {
      cloud(ctx, at(0.32), y + h * 0.34, 1.1);
      cloud(ctx, at(0.8), y + h * 0.16, 0.7);
    }
    ctx.globalAlpha = 1;
  }
}

/** Slanted bands of light on the glass, clipped to it. */
function paintGlints(ctx: Ctx2D): void {
  const { x, y, w, h } = GLASS;
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
function bar(ctx: Ctx2D, x: number, y: number, w: number, h: number, color: number): void {
  ctx.fillStyle = cssColor(outlineColor(color));
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = cssColor(color);
  ctx.fillRect(x, y, w, h);
}

function paintFrame(ctx: Ctx2D, place: StartPlaceId, weather: WeatherId): void {
  const look = WINDOW_LOOK.colors[place];
  const frame = look.frame;
  const dark = outlineColor(frame);
  const { x, y, w, h } = GLASS;
  const sillY = y + h + 12;
  // Sill: two tones, the dark one is the outline under the light one.
  roundRect(ctx, 6, sillY, W - 12, 26, 10);
  ctx.fillStyle = cssColor(dark);
  ctx.fill();
  roundRect(ctx, 8, sillY + 2, W - 16, 17, 8);
  ctx.fillStyle = cssColor(shade(frame, 0.1));
  ctx.fill();
  // Frame: outline, body, lighter inner ring.
  framePath(ctx, place, OUTLINE_PX);
  ctx.fillStyle = cssColor(dark);
  ctx.fill();
  framePath(ctx, place, 0);
  ctx.fillStyle = cssColor(frame);
  ctx.fill();
  glassPath(ctx, place, 6);
  ctx.fillStyle = cssColor('ring' in look ? look.ring : shade(frame, 0.22));
  ctx.fill();
  glassPath(ctx, place, 2);
  ctx.fillStyle = cssColor(dark);
  ctx.fill();
  // Glass: sky, glints and the sash.
  ctx.save();
  glassPath(ctx, place);
  ctx.clip();
  paintSky(ctx, WINDOW_SKY[weather], place === 'shop');
  paintGlints(ctx);
  const sash = 'ring' in look ? look.ring : shade(frame, 0.12);
  bar(ctx, x + w / 2 - 4, y - 4, 8, h + 8, sash);
  bar(ctx, x - 4, y + h * 0.52, w + 8, 8, sash);
  ctx.restore();
  // Soft shade along the inner edge of the glass.
  glassPath(ctx, place);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(60,30,30,0.22)';
  ctx.stroke();
  // Gloss mark on the frame.
  roundRect(ctx, x - 13, y + 24, 5, 46, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  if (place === 'kitchen') paintValance(ctx);
}

/** A scalloped cloth over the top of the kitchen window. */
function paintValance(ctx: Ctx2D): void {
  const look = WINDOW_LOOK.colors.kitchen;
  const left = 8;
  const right = W - 8;
  const top = 12;
  const band = 22;
  const scallops = 6;
  const step = (right - left) / scallops;
  for (const [grow, color] of [
    [3, look.valanceOutline],
    [0, look.valance],
  ] as const) {
    ctx.fillStyle = cssColor(color);
    roundRect(ctx, left - grow, top - grow, right - left + 2 * grow, band + 2 * grow, 8);
    ctx.fill();
    for (let i = 0; i < scallops; i++) {
      ctx.beginPath();
      ctx.arc(left + step * (i + 0.5), top + band, step / 2 + grow, 0, Math.PI);
      ctx.fill();
    }
  }
  ctx.fillStyle = cssColor(look.valanceStripe);
  for (let i = 0; i < scallops; i += 2) {
    ctx.beginPath();
    ctx.arc(left + step * (i + 0.5), top + band, step / 2 - 2, 0, Math.PI);
    ctx.fill();
    ctx.fillRect(left + step * i + 2, top + 2, step - 4, band - 2);
  }
  roundRect(ctx, left + 10, top + 4, 30, 4, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
}

/** Bakes the window picture of a start place for the weather of this run (one picture, on the shared atlas). */
export function bakeWindow(scene: Phaser.Scene, place: StartPlaceId, weather: WeatherId): string {
  const key = windowKey(place, weather);
  bakeTexture(
    scene,
    key,
    W,
    H,
    () => undefined,
    (ctx) => paintFrame(ctx, place, weather),
  );
  return key;
}

/** Bakes the small pictures that move on the glass in this weather; none for clear, sunset and night. */
export function bakeGlassItems(scene: Phaser.Scene, weather: WeatherId): void {
  const spec = GLASS_WEATHER[weather];
  if (!spec) return;
  if (spec.item === 'drop') {
    const d = GLASS_LOOK.drop;
    bakeTexture(scene, GLASS_TEX.drop, d.w, d.h, (g) => {
      const r = d.w / 2;
      const body = (grow: number, color: number): void => {
        g.fillStyle(color, 1);
        g.fillCircle(r, d.h - r, r - 1 + grow);
        g.fillTriangle(
          r,
          1 - grow,
          r - r * 0.8 - grow,
          d.h - r - 2,
          r + r * 0.8 + grow,
          d.h - r - 2,
        );
      };
      body(1.5, d.dark);
      body(0, d.color);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(r - 2.5, d.h - r + 1, 2);
    });
  } else if (spec.item === 'flake') {
    const s = GLASS_LOOK.flake.size;
    bakeTexture(scene, GLASS_TEX.flake, s, s, (g) => {
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(s / 2, s / 2, s / 2);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(s / 2, s / 2, s / 3.2);
    });
  } else {
    const { w, h, color, dark } = GLASS_LOOK.leaf;
    bakeTexture(scene, GLASS_TEX.leaf, w, h, (g) => {
      const half = (lower: boolean, grow: number): { x: number; y: number }[] =>
        Array.from({ length: 13 }, (_, i) => {
          const t = i / 12;
          const bulge = Math.sin(Math.PI * t ** 0.8) ** 0.85;
          return {
            x: 4 + (w - 14) * t,
            y: h / 2 + (lower ? 1 : -1) * (bulge * (h / 2 - 3) + (bulge > 0 ? grow : 0)),
          };
        });
      const body = (grow: number, fill: number, lowerOnly = false): void => {
        g.fillStyle(fill, 1);
        if (!lowerOnly) fillPolygon(g, [...half(false, grow), ...half(true, grow).reverse()]);
        else
          fillPolygon(g, [
            ...half(true, grow),
            ...half(false, 0).map((p) => ({ x: p.x, y: h / 2 })),
          ]);
      };
      body(2, dark);
      g.fillStyle(dark, 1);
      g.fillRect(w - 13, h / 2 - 1.5, 12, 3);
      body(0, color);
      body(0, shade(color, -0.22), true);
      g.fillStyle(dark, 1);
      g.fillRect(6, h / 2 - 1, w - 20, 2);
    });
  }
}

/** Where the window of a start place stands, for `Hover`: the picture and where its glass is on the screen. */
export function windowRectOf(place: StartPlaceId, width: number, height: number): Rect {
  const look = WINDOW_LOOK[place];
  const cx = look.at.x * width + look.offset.x;
  const cy = look.at.y * height + look.offset.y;
  const [from, to] = GLASS_LOOK.windowSpan[place];
  return {
    x: cx - W / 2 + GLASS.x + GLASS.w * from,
    y: cy - H / 2 + GLASS.y,
    w: GLASS.w * (to - from),
    h: GLASS.h,
  };
}

/** Where the glass items may be and what they keep out of. */
export interface GlassArea {
  /** The rectangles items live in (they are dealt out one by one). */
  rects(ctx: FrameCtx): readonly Rect[];
  /** True where the area keeps the HUD and the flying layer's row clear (the wide Showcase panes). */
  keepClear: boolean;
}

/**
 * Drops, flakes or leaves on the glass of one window or of the Showcase panes. They are images of
 * the shared atlas made when the scenery is built: full effects move them, lite leaves them still,
 * minimal shows none (only the sky colour remains).
 */
export class GlassWeatherLife implements Life {
  readonly objects: Phaser.GameObjects.Image[];
  private readonly pose = newGlassPose();
  private shown: boolean | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly spec: GlassWeather,
    count: number,
    private readonly area: GlassArea,
    private readonly size = 1,
  ) {
    const tint = GLASS_LOOK.leaf.tints;
    this.objects = Array.from({ length: count }, (_, i) => {
      const image = new Phaser.GameObjects.Image(scene, 0, 0, GLASS_TEX[spec.item]);
      if (spec.item === 'leaf') image.setTint(tint[i % tint.length] ?? 0xffffff);
      return image.setVisible(false);
    });
  }

  update(ctx: FrameCtx): void {
    const minimal = effectsMode.reduced;
    if (minimal !== this.shown) {
      this.shown = minimal;
      for (const image of this.objects) image.setVisible(!minimal);
    }
    if (minimal) return;
    const still = effectsMode.atMost('lite');
    const rects = this.area.rects(ctx);
    const time = still ? 0 : ctx.timeMs;
    const band = this.area.keepClear ? ctx.clearBand : null;
    this.objects.forEach((image, i) => {
      const rect = rects[i % rects.length];
      if (!rect) return;
      const pose = glassPose(this.spec, i, time, this.pose);
      const x = rect.x + rect.w * pose.u;
      const y = rect.y + rect.h * pose.v;
      let alpha = pose.alpha;
      if (band) {
        const fade = GLASS_LOOK.bandFadePx;
        const away = Math.max(band.top - y, y - band.bottom, 0) / fade;
        const below = (y - (band.ceiling ?? 0)) / fade;
        alpha *= Math.min(1, Math.max(0, Math.min(away, below)));
      }
      image
        .setPosition(x, y)
        .setRotation(pose.rotation)
        .setScale(pose.scale * this.size)
        .setAlpha(alpha);
    });
  }
}

/** The life of the glass of a window of a start place for this weather; null when the weather leaves nothing on it. */
export function windowGlassLife(
  scene: Phaser.Scene,
  place: StartPlaceId,
  weather: WeatherId,
): GlassWeatherLife | null {
  const spec = GLASS_WEATHER[weather];
  if (!spec) return null;
  return new GlassWeatherLife(scene, spec, spec.window, {
    keepClear: false,
    rects: (ctx) => [windowRectOf(place, ctx.width, ctx.height)],
  });
}

/**
 * Shows what it wraps only in a run: the menu scenery (no flying-layer band) keeps its home kitchen
 * without the window, which would peek out from behind the crew table and the plates.
 */
export class RunOnly implements Life {
  readonly objects: readonly Phaser.GameObjects.GameObject[];
  private shown: boolean | null = null;

  constructor(private readonly inner: readonly Life[]) {
    this.objects = inner.flatMap((life) => life.objects);
  }

  update(ctx: FrameCtx): void {
    const inRun = ctx.clearBand !== null;
    if (inRun !== this.shown) {
      this.shown = inRun;
      for (const object of this.objects) {
        if ('setVisible' in object && typeof object.setVisible === 'function') {
          object.setVisible(inRun);
        }
      }
    }
    if (inRun) for (const life of this.inner) life.update(ctx);
  }
}

/** The life of the Showcase panes: items in two bands at the sides of the tower, keeping off the HUD and the flying layer's row. */
export function showcaseGlassLife(
  scene: Phaser.Scene,
  weather: WeatherId,
): GlassWeatherLife | null {
  const spec = GLASS_WEATHER[weather];
  if (!spec) return null;
  const { near, far, lowest } = GLASS_LOOK.showcaseBands;
  return new GlassWeatherLife(
    scene,
    spec,
    spec.showcase,
    {
      keepClear: true,
      rects: (ctx) => {
        const top = ctx.clearBand?.ceiling ?? 0;
        const height = ctx.height * lowest - top;
        return [
          { x: near, y: top, w: far - near, h: height },
          { x: ctx.width - far, y: top, w: far - near, h: height },
        ];
      },
    },
    GLASS_LOOK.showcaseSize,
  );
}
