import * as Phaser from 'phaser';
import {
  GLASS_LOOK,
  GLASS_TEX,
  GLASS_WEATHER,
  WINDOW_LOOK,
  WALL_LOOK,
  WINDOW_SKY,
  windowKey,
  type GlassWeather,
} from '../../../data/weather/window-look';
import type { StartPlaceId } from '../../../data/zones/start-places';
import type { WeatherId } from '../../../data/weather/weather';
import { WEATHER_LOOK } from '../../../data/weather/weather-look';
import { cssColor, shade } from '../../../util/color';
import { effectsMode } from '../../effects-mode';
import { fillPolygon, outlineColor } from '../../fx/plain-style';
import { bakePadded, bakeTexture } from '../../ui/bake-texture';
import { FIELD_PAD } from '../../../data/common/picture-fields';
import { glassPose, newGlassPose } from './glass-motion';
import { bar, paintGlints, paintSky, paintValance, roundRect } from './window-paint';
import { flightClearBand } from '../../camera-layout';
import type { FrameCtx, Life } from './life';
import { inSky, onLayer, type Anchor } from './layer-anchor';
import type { LayerSpot } from './layer-life';
import { flightRowShade } from './weather-motion';

type Ctx2D = CanvasRenderingContext2D;

/** A rectangle of the screen in logical px (where glass items live). */
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
  if (place === 'kitchen') {
    paintValance(ctx, { left: 8, right: W - 8, top: 12, band: 22, scallops: 6, radius: 8 });
  }
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
    bakePadded(scene, GLASS_TEX.drop, d.w, d.h, FIELD_PAD.windowDrop, (g) => {
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

/** The glass of the window of a start place whose picture stands at (`x`, `y`); `mirrored` is a picture drawn flipped. */
export function glassRectAt(
  place: StartPlaceId,
  x: number,
  y: number,
  mirrored: boolean,
  out: Rect = { x: 0, y: 0, w: 0, h: 0 },
): Rect {
  const [start, end] = GLASS_LOOK.windowSpan[place];
  const [from, to] = mirrored ? [1 - end, 1 - start] : [start, end];
  out.x = x - W / 2 + GLASS.x + GLASS.w * from;
  out.y = y - H / 2 + GLASS.y;
  out.w = GLASS.w * (to - from);
  out.h = GLASS.h;
  return out;
}

/** Where the glass items may be and what they keep out of. */
export interface GlassArea {
  /** The rectangles items live in (they are dealt out one by one); the array is reused, not rebuilt, every frame. */
  rects(ctx: FrameCtx): readonly Rect[];
  /** Extra alpha factor of the whole area (a window that is off the screen or muted); 1 when absent. */
  alpha?(): number;
  /**
   * The row of the incoming layer: items in it are paler (`flightRowShade`), so the layer reads in front of them. Absent:
   * the area has no row of its own (a small wall window, muted as a whole with its window).
   */
  band?(ctx: FrameCtx): { top: number; bottom: number };
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
  private offScreen = false;

  constructor(
    scene: Phaser.Scene,
    private readonly spec: GlassWeather,
    count: number,
    private readonly area: GlassArea,
    readonly anchor: Anchor,
    private readonly size = 1,
    /** On lite only the first half of the items is drawn. */
    private readonly halveOnLite = false,
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
    const areaAlpha = this.area.alpha?.() ?? 1;
    // The window this glass belongs to is off the screen: hide the items once and work out nothing until it is back.
    const away = areaAlpha <= 0;
    if (away !== this.offScreen) {
      this.offScreen = away;
      for (const image of this.objects) image.setVisible(!away);
    }
    if (away) return;
    const still = effectsMode.atMost('lite');
    const rects = this.area.rects(ctx);
    const time = still ? 0 : ctx.timeMs;
    const band = this.area.band?.(ctx) ?? null;
    const cap =
      this.halveOnLite && still ? Math.ceil(this.objects.length / 2) : this.objects.length;
    this.objects.forEach((image, i) => {
      if (this.halveOnLite) image.setVisible(i < cap);
      const rect = rects[i % rects.length];
      if (!rect || i >= cap) return;
      const pose = glassPose(this.spec, i, time, this.pose);
      const x = rect.x + rect.w * pose.u;
      const y = rect.y + rect.h * pose.v;
      let alpha = pose.alpha * areaAlpha;
      // Under the HUD plates the items are not faded: they are background and pass behind the plates.
      if (band)
        alpha *= flightRowShade(y, band, GLASS_LOOK.bandFadePx, WEATHER_LOOK.flightRowAlpha);
      image
        .setPosition(x, y)
        .setRotation(pose.rotation)
        .setScale(pose.scale * this.size)
        .setAlpha(alpha);
    });
  }
}

/**
 * The lives of the glass of the windows of a start place for this weather, one per pool slot of the wall window (`spots`):
 * the items ride with their own window. Empty when the weather leaves nothing on the glass.
 */
export function windowGlassLives(
  scene: Phaser.Scene,
  place: StartPlaceId,
  weather: WeatherId,
  spots: readonly LayerSpot[],
): GlassWeatherLife[] {
  const spec = GLASS_WEATHER[weather];
  if (!spec) return [];
  return spots.map((spot) => {
    const rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
    const rects = [rect];
    return new GlassWeatherLife(
      scene,
      spec,
      spec.window,
      {
        alpha: () => spot.alpha,
        rects: () => {
          glassRectAt(place, spot.x, spot.y, spot.mirrored, rect);
          return rects;
        },
      },
      onLayer(WALL_LOOK.layer),
    );
  });
}

/**
 * Shows what it wraps only in a run: the menu scenery (no flying-layer band) keeps its home kitchen
 * without the window, which would peek out from behind the crew table and the plates.
 */
export class RunOnly implements Life {
  readonly objects: readonly Phaser.GameObjects.GameObject[];
  private shown: boolean | null = null;

  constructor(
    private readonly inner: readonly Life[],
    readonly anchor: Anchor,
  ) {
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

/** The life of the Showcase panes: items in two bands at the sides of the tower over the whole screen height, paler in the flying layer's row. */
export function showcaseGlassLife(
  scene: Phaser.Scene,
  weather: WeatherId,
): GlassWeatherLife | null {
  const spec = GLASS_WEATHER[weather];
  if (!spec) return null;
  const { near, far, lowest } = GLASS_LOOK.showcaseBands;
  const left: Rect = { x: 0, y: 0, w: 0, h: 0 };
  const right: Rect = { x: 0, y: 0, w: 0, h: 0 };
  const rects = [left, right];
  const band = { top: 0, bottom: 0 };
  let bandHeight = -1;
  return new GlassWeatherLife(
    scene,
    spec,
    spec.showcase,
    {
      // The same row the street weather behind the glass is paler in.
      band: (ctx) => {
        if (ctx.height !== bandHeight) {
          bandHeight = ctx.height;
          Object.assign(band, flightClearBand(ctx.height));
        }
        return band;
      },
      rects: (ctx) => {
        const height = ctx.height * lowest;
        left.x = near;
        left.y = 0;
        left.w = far - near;
        left.h = height;
        right.x = ctx.width - far;
        right.y = 0;
        right.w = far - near;
        right.h = height;
        return rects;
      },
    },
    inSky('weather'),
    GLASS_LOOK.showcaseSize,
  );
}
