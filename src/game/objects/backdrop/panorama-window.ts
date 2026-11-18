import type * as Phaser from 'phaser';
import {
  GLASS_WEATHER,
  PANORAMA,
  WALL_LOOK,
  WINDOW_LOOK,
  WINDOW_SKY,
  panoramaFlashKey,
  panoramaKey,
  type GlassWeather,
} from '../../../data/window-look';
import type { StartPlaceId } from '../../../data/start-places';
import type { WeatherId } from '../../../data/weather';
import { cssColor, shade } from '../../../util/color';
import { TWO_PI } from '../../../util/math';
import { outlineColor } from '../../fx/plain-style';
import { bakeTexture } from '../../ui/bake-texture';
import { hudFloor } from '../../camera-layout';
import { onLayer } from './layer-anchor';
import type { LayerSpot } from './layer-life';
import { GlassWeatherLife, type Rect } from './window-weather';
import type { Life } from './life';
import { LayerThing } from './layer-life';
import { PanoramaFlash } from './panorama-flash';
import { panoramaFitCached } from './panorama-fit';
import { bar, paintGlints, paintSky, paintValance, roundRect } from './window-paint';

type Ctx2D = CanvasRenderingContext2D;

const P = PANORAMA;
const G = P.glass;
const W = P.width;
const H = P.height;

/** The outline of the glass or the frame, grown by `grow`: a rounded rectangle (kitchen) or one with a low arch on top (shop). */
export function panePath(ctx: Ctx2D, place: StartPlaceId, grow: number): void {
  const x = G.x - grow;
  const y = G.y - grow;
  const w = G.w + 2 * grow;
  const h = G.h + 2 * grow;
  if (place === 'kitchen') {
    roundRect(ctx, x, y, w, h, 24 + grow);
    return;
  }
  const bottom = 14 + grow;
  const rx = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + P.archPx);
  ctx.ellipse(x + rx, y + P.archPx, rx, P.archPx, 0, Math.PI, 0);
  ctx.lineTo(x + w, y + h - bottom);
  ctx.arcTo(x + w, y + h, x + w - bottom, y + h, bottom);
  ctx.lineTo(x + bottom, y + h);
  ctx.arcTo(x, y + h, x, y + h - bottom, bottom);
  ctx.closePath();
}

function paintSill(ctx: Ctx2D, frame: number): void {
  const dark = outlineColor(frame);
  const y = G.y + G.h + P.sill.gap;
  const { height } = P.sill;
  const edge = P.outlinePx;
  roundRect(ctx, 8, y, W - 16, height, 20);
  ctx.fillStyle = cssColor(dark);
  ctx.fill();
  roundRect(ctx, 8 + edge / 2, y + edge / 2, W - 16 - edge, height - edge, 16);
  ctx.fillStyle = cssColor(frame);
  ctx.fill();
  roundRect(ctx, 20, y + 6, W - 40, height * 0.42, 10);
  ctx.fillStyle = cssColor(shade(frame, 0.16));
  ctx.fill();
  roundRect(ctx, 44, y + 11, 150, 7, 3.5);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
}

/** Short darker strokes along the wooden frame sides, like boards. */
function paintGrain(ctx: Ctx2D, frame: number): void {
  ctx.strokeStyle = cssColor(shade(frame, -0.14));
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const side of [G.x - P.framePx / 2, G.x + G.w + P.framePx / 2]) {
    for (const [from, length] of [
      [0.22, 70],
      [0.5, 46],
      [0.78, 64],
    ] as const) {
      const y = G.y + G.h * from;
      ctx.beginPath();
      ctx.moveTo(side, y);
      ctx.lineTo(side, y + length);
      ctx.stroke();
    }
  }
}

/** A cream keystone at the top of the arch of the shop window. */
function paintKeystone(ctx: Ctx2D, dark: number, cream: number): void {
  const cx = G.x + G.w / 2;
  const cy = G.y - P.framePx / 2 - 2;
  ctx.fillStyle = cssColor(dark);
  ctx.beginPath();
  ctx.arc(cx, cy, 17, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = cssColor(cream);
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, TWO_PI);
  ctx.fill();
}

function paintPanorama(ctx: Ctx2D, place: StartPlaceId, weather: WeatherId): void {
  const look = WINDOW_LOOK.colors[place];
  const frame = look.frame;
  const dark = outlineColor(frame);
  const ring = 'ring' in look ? look.ring : shade(frame, 0.22);
  paintSill(ctx, frame);
  // Frame: outline, body, a lighter ring and the dark rim of the glass.
  for (const [grow, color] of [
    [P.framePx + P.outlinePx, dark],
    [P.framePx, frame],
    [12, ring],
    [4, dark],
  ] as const) {
    panePath(ctx, place, grow);
    ctx.fillStyle = cssColor(color);
    ctx.fill();
  }
  if (place === 'kitchen') paintGrain(ctx, frame);
  ctx.save();
  panePath(ctx, place, 0);
  ctx.clip();
  paintSky(ctx, WINDOW_SKY[weather], false, G);
  paintGlints(ctx, G);
  const sash = 'ring' in look ? look.ring : shade(frame, 0.12);
  bar(ctx, G.x + G.w / 2 - P.barPx / 2, G.y - 4, P.barPx, G.h + 8, sash);
  bar(ctx, G.x - 4, G.y + G.h * P.crossAt - P.barPx / 2, G.w + 8, P.barPx, sash);
  ctx.restore();
  panePath(ctx, place, 0);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(60,30,30,0.22)';
  ctx.stroke();
  // Gloss mark on the frame.
  roundRect(ctx, G.x - 25, G.y + 36, 9, 120, 4.5);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  if (place === 'kitchen') {
    const v = P.valance;
    paintValance(ctx, {
      left: G.x - 14,
      right: G.x + G.w + 14,
      top: v.top,
      band: v.band,
      scallops: v.scallops,
      radius: 14,
    });
  } else {
    paintKeystone(ctx, dark, ring);
  }
}

/** Bakes the panoramic window of a place for the weather of the run (its own texture, see `PANORAMA`). */
export function bakePanorama(scene: Phaser.Scene, place: StartPlaceId, weather: WeatherId): string {
  const key = panoramaKey(place, weather);
  bakeTexture(
    scene,
    key,
    W,
    H,
    () => undefined,
    (ctx) => paintPanorama(ctx, place, weather),
  );
  return key;
}

/** Margin (px) round the baked flash shape, so its edge is never cut. */
export const FLASH_MARGIN = 3;

/** The glass-shaped patch that flashes in a storm: baked at `bakeShare` of the size (a flat flash needs no more). */
export function bakePanoramaFlash(scene: Phaser.Scene, place: StartPlaceId, key: string): void {
  const share = P.flash.bakeShare;
  bakeTexture(
    scene,
    key,
    G.w * share + 2 * FLASH_MARGIN,
    G.h * share + 2 * FLASH_MARGIN,
    () => undefined,
    (ctx) => {
      ctx.translate(FLASH_MARGIN, FLASH_MARGIN);
      ctx.scale(share, share);
      ctx.translate(-G.x, -G.y);
      // The kitchen valance hangs over the top of the glass: the flash does not light the cloth.
      if (place === 'kitchen') {
        ctx.beginPath();
        ctx.rect(G.x - 4, P.valance.top + P.valance.band, G.w + 8, G.h);
        ctx.clip();
      }
      panePath(ctx, place, 0);
      ctx.fillStyle = cssColor(P.flash.color);
      ctx.fill();
    },
  );
}

/** The glass of the panoramic window whose picture is centred at (`x`, `y`) and drawn at `scale`. */
export function panoramaGlassAt(x: number, y: number, scale: number, out: Rect): Rect {
  out.x = x + (G.x - W / 2) * scale;
  out.y = y + (G.y - H / 2) * scale;
  out.w = G.w * scale;
  out.h = G.h * scale;
  return out;
}

/** Number of drops, flakes or leaves on the pane in this weather; 0 when the weather leaves nothing on the glass. */
function itemCount(weather: WeatherId): number {
  const items = P.items;
  if (weather === 'rain') return items.rain;
  if (weather === 'storm') return items.storm;
  if (weather === 'snow') return items.snow;
  if (weather === 'leaves') return items.leaves;
  return 0;
}

/** The drops, flakes or leaves of the panoramic window: they ride with it, half of them on lite, none on minimal. */
export function panoramaGlassLife(
  scene: Phaser.Scene,
  weather: WeatherId,
  spot: LayerSpot,
): GlassWeatherLife | null {
  const spec: GlassWeather | undefined = GLASS_WEATHER[weather];
  const count = itemCount(weather);
  if (!spec || count === 0) return null;
  const rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  const rects = [rect];
  const band = { top: 0, bottom: 0, ceiling: hudFloor() };
  return new GlassWeatherLife(
    scene,
    spec,
    count,
    {
      keepClear: true,
      // The drops fade in the row the incoming layer flies in right now (and under the HUD floor).
      band: (ctx) => {
        band.top = ctx.flightRow.top;
        band.bottom = ctx.flightRow.bottom;
        return band;
      },
      alpha: () => spot.alpha,
      rects: () => {
        panoramaGlassAt(spot.x, spot.y, spot.scale, rect);
        return rects;
      },
    },
    onLayer(WALL_LOOK.layer),
    P.items.size,
    true,
  );
}

/** Bakes what the panoramic window of a place needs for the weather of the run: its picture and, in a storm, the flash. */
export function bakePanoramaSet(
  scene: Phaser.Scene,
  place: StartPlaceId,
  weather: WeatherId,
): void {
  bakePanorama(scene, place, weather);
  if (weather === 'storm') bakePanoramaFlash(scene, place, panoramaFlashKey(place));
}

/** True where the panoramic window has no room (a short screen) and the small window stands on the start view instead. */
export function panoramaMissing(width: number, height: number): boolean {
  return panoramaFitCached(width, height) === null;
}

/** The panoramic window of the start view with its drops and its storm flash, back to front. Built with the zone; made only in a run. */
export function panoramaLives(
  scene: Phaser.Scene,
  place: StartPlaceId,
  weather: WeatherId,
): Life[] {
  const window = new LayerThing(
    scene,
    [
      {
        texture: panoramaKey(place, weather),
        at: { x: 0.5, y: 0 },
        offset: { x: 0, y: 0 },
        pulse: WINDOW_LOOK.pulse,
      },
    ],
    { layer: WALL_LOOK.layer, halfH: H / 2, fit: panoramaFitCached, rowMute: true },
  );
  const spot = window.spots[0];
  if (!spot) return [window];
  const glass = panoramaGlassLife(scene, weather, spot);
  const flash =
    weather === 'storm' ? new PanoramaFlash(scene, panoramaFlashKey(place), spot) : null;
  return [window, ...(glass ? [glass] : []), ...(flash ? [flash] : [])];
}
