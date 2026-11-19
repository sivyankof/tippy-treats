import * as Phaser from 'phaser';
import {
  GLASS_WEATHER,
  PANORAMA,
  SHOP_COLORS,
  WALL_LOOK,
  WINDOW_LOOK,
  WINDOW_SKY,
  panoramaBoltKey,
  panoramaFlashKey,
  panoramaMoonKey,
  panoramaPieces,
  type GlassWeather,
} from '../../../../data/weather/window-look';
import type { StartPlaceId } from '../../../../data/zones/start-places';
import type { WeatherId } from '../../../../data/weather/weather';
import { KITCHEN_COLORS } from '../../../../data/common/palette';
import { cssColor, mixColor, shade } from '../../../../util/color';
import { TWO_PI } from '../../../../util/math';
import { outlineColor } from '../../../fx/common/plain-style';
import { bakeTexture } from '../../../ui/bake-texture';
import { onLayer } from '../life/layer-anchor';
import type { LayerSpot } from '../life/layer-life';
import { GlassWeatherLife, type Rect } from '../weather/window-weather';
import type { Life } from '../life/life';
import { LayerThing } from '../life/layer-life';
import { PanoramaFlash } from './panorama-flash';
import {
  bakePanoramaBolt,
  bakePanoramaFlash,
  bakePanoramaMoon,
  panePath,
  panoramaValance,
  sashBars,
} from './panorama-art';
import { PanoramaMoon } from './panorama-moon';
import { panoramaFitCached } from './panorama-fit';
import { bar, paintGlints, paintSky, paintValance, roundRect } from './window-paint';

type Ctx2D = CanvasRenderingContext2D;

const P = PANORAMA;
const G = P.glass;
const W = P.width;
const H = P.height;

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
  // The moon is a picture of its own (`bakePanoramaMoon`): it leaves before the window does.
  paintSky(ctx, WINDOW_SKY[weather], false, G, false);
  paintGlints(ctx, G);
  const sash = 'ring' in look ? look.ring : shade(frame, 0.12);
  for (const b of sashBars()) bar(ctx, b.x, b.y, b.w, b.h, sash);
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
    paintValance(ctx, panoramaValance());
  } else {
    paintKeystone(ctx, dark, ring);
  }
}

/**
 * Bakes the panoramic window of a place for the weather of the run as pieces of the shared atlas (`PANORAMA.pieces`).
 * The whole picture is painted once into a canvas that the pieces are cut from; the canvas is dropped after the last.
 */
export function bakePanorama(
  scene: Phaser.Scene,
  place: StartPlaceId,
  weather: WeatherId,
): string[] {
  const pieces = panoramaPieces(place, weather);
  const bakedW = Math.round(W * P.bakeScale);
  const bakedH = Math.round(H * P.bakeScale);
  let full: HTMLCanvasElement | null = null;
  pieces.forEach((piece, i) => {
    bakeTexture(
      scene,
      piece.key,
      piece.width,
      piece.height,
      () => undefined,
      (ctx) => {
        if (!full) {
          full = document.createElement('canvas');
          full.width = bakedW;
          full.height = bakedH;
          const fullCtx = full.getContext('2d');
          if (fullCtx) {
            fullCtx.scale(bakedW / W, bakedH / H);
            paintPanorama(fullCtx, place, weather);
          }
        }
        ctx.drawImage(full, -piece.x, -piece.y);
        if (i === pieces.length - 1) full = null;
      },
    );
  });
  return pieces.map((piece) => piece.key);
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
  const band = { top: 0, bottom: 0 };
  return new GlassWeatherLife(
    scene,
    spec,
    count,
    {
      // The drops are paler in the row the incoming layer flies in right now (not faded under the HUD).
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

/** How many sceneries hold each baked panorama picture; the last one to go frees its cell on the atlas. */
const holds = new Map<string, number>();

function panoramaKeys(place: StartPlaceId, weather: WeatherId): string[] {
  const keys = panoramaPieces(place, weather).map((piece) => piece.key);
  if (weather === 'storm') keys.push(panoramaFlashKey(place), panoramaBoltKey(place));
  if (WINDOW_SKY[weather].moon) keys.push(panoramaMoonKey(place));
  return keys;
}

/**
 * Bakes what the panoramic window of a place needs for the weather of the run: its picture and, in a storm, the flash.
 * The pictures are big (a 648 px shelf of the shared atlas), so they are given back when the scenery that holds them is
 * destroyed (`releasePanorama`): the start zone is gone after the cross-fade into the Showcase, and the freed shelf
 * is reused by the pictures of the zones above it.
 */
export function bakePanoramaSet(
  scene: Phaser.Scene,
  place: StartPlaceId,
  weather: WeatherId,
): void {
  bakePanorama(scene, place, weather);
  if (weather === 'storm') {
    bakePanoramaFlash(scene, place, panoramaFlashKey(place));
    bakePanoramaBolt(scene, place, panoramaBoltKey(place));
  }
  if (WINDOW_SKY[weather].moon) bakePanoramaMoon(scene, place, panoramaMoonKey(place));
  for (const key of panoramaKeys(place, weather)) holds.set(key, (holds.get(key) ?? 0) + 1);
}

/** One scenery lets go of its panorama pictures; the texture goes with the last one. */
function releasePanorama(scene: Phaser.Scene, place: StartPlaceId, weather: WeatherId): void {
  for (const key of panoramaKeys(place, weather)) {
    const left = (holds.get(key) ?? 0) - 1;
    if (left > 0) {
      holds.set(key, left);
      continue;
    }
    holds.delete(key);
    if (scene.textures.exists(key)) scene.textures.remove(key);
  }
}

/** True where the panoramic window has no room (a short screen) and the small window stands on the start view instead. */
export function panoramaMissing(width: number, height: number): boolean {
  return panoramaFitCached(width, height) === null;
}

/**
 * The tint the window takes while the incoming layer flies in front of it: white leaned towards the wall behind it by the
 * share the mute would give by alpha (a multiply tint cannot lighten, but a muted window is only a little quieter).
 */
function muteTone(place: StartPlaceId): number {
  const wall = place === 'kitchen' ? KITCHEN_COLORS.wall : SHOP_COLORS.skyBottom;
  return mixColor(0xffffff, wall, 1 - P.rowMuted);
}

/** The panoramic window of the start view with its drops and its storm flash, back to front. Built with the zone; made only in a run. */
export function panoramaLives(
  scene: Phaser.Scene,
  place: StartPlaceId,
  weather: WeatherId,
): Life[] {
  const window = new LayerThing(
    scene,
    panoramaPieces(place, weather).map((piece) => ({
      texture: piece.key,
      at: { x: 0.5, y: 0 },
      offset: { x: piece.centreX, y: piece.centreY },
      scale: 1 / P.bakeScale,
    })),
    {
      layer: WALL_LOOK.layer,
      halfH: H / 2,
      fit: panoramaFitCached,
      rowMute: true,
      muteTone: muteTone(place),
      seamPx: P.seamPx,
    },
  );
  const image = window.objects[0];
  image?.once(Phaser.GameObjects.Events.DESTROY, () => releasePanorama(scene, place, weather));
  const spot = window.spots[0];
  if (!spot) return [window];
  // The moon comes right after the pieces: the same atlas page, so the batch is not broken.
  const moon = WINDOW_SKY[weather].moon
    ? new PanoramaMoon(scene, panoramaMoonKey(place), spot)
    : null;
  const glass = panoramaGlassLife(scene, weather, spot);
  const flash =
    weather === 'storm'
      ? new PanoramaFlash(scene, panoramaFlashKey(place), panoramaBoltKey(place), spot)
      : null;
  return [window, ...(moon ? [moon] : []), ...(glass ? [glass] : []), ...(flash ? [flash] : [])];
}
