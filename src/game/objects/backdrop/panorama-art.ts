import type * as Phaser from 'phaser';
import { PANORAMA } from '../../../data/window-look';
import { WEATHER_LOOK } from '../../../data/weather-look';
import type { StartPlaceId } from '../../../data/start-places';
import { cssColor } from '../../../util/color';
import { bakeTexture } from '../../ui/bake-texture';
import { BOLT_COLORS, boltLines } from './weather-art';
import {
  HEAVY_CLOUDS,
  cloud,
  detailScale,
  moonSpot,
  paintGlints,
  paintMoon,
  paintValance,
  roundRect,
  type ValanceBox,
} from './window-paint';

type Ctx2D = CanvasRenderingContext2D;

const P = PANORAMA;
const G = P.glass;

/** Margin (px) round the small baked pictures of the window (the flash, the moon), so their edges are never cut. */
export const PANORAMA_ART_MARGIN = 3;

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

/** The scalloped valance over the top of the kitchen panorama glass. */
export function panoramaValance(): ValanceBox {
  const v = P.valance;
  return {
    left: G.x - 14,
    right: G.x + G.w + 14,
    top: v.top,
    band: v.band,
    scallops: v.scallops,
    radius: 14,
  };
}

/** The two sash bars of the glass: the vertical one in the middle and the horizontal one at `crossAt`. */
export function sashBars(): { x: number; y: number; w: number; h: number }[] {
  return [
    { x: G.x + G.w / 2 - P.barPx / 2, y: G.y - 4, w: P.barPx, h: G.h + 8 },
    { x: G.x - 4, y: G.y + G.h * P.crossAt - P.barPx / 2, w: G.w + 8, h: P.barPx },
  ];
}

/** Erases what hangs in front of the glass (the sash bars, the kitchen valance) from what is painted so far. */
function cutFront(ctx: Ctx2D, place: StartPlaceId, bars: boolean): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  // The bars carry a 2 px outline on every side (`bar`).
  if (bars) for (const b of sashBars()) ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
  if (place === 'kitchen') paintValance(ctx, panoramaValance());
  ctx.restore();
}

/** The bolt of the window flash: the sky bolt's zig-zag and colours, smaller, in the upper right pane. */
function paintFlashBolt(ctx: Ctx2D): void {
  const L = WEATHER_LOOK.lightning;
  const b = P.flash.bolt;
  const w = L.width * b.scale;
  const h = G.h * b.height;
  const { trunk, branch } = boltLines(w, h, 0);
  const x0 = G.x + G.w * b.x - (trunk[0]?.x ?? 0);
  const y0 = G.y + G.h * b.top;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [width, color] of [
    [L.rimPx, BOLT_COLORS.rim],
    [L.midPx, BOLT_COLORS.mid],
    [L.corePx, BOLT_COLORS.core],
  ] as const) {
    ctx.strokeStyle = cssColor(color);
    for (const line of [trunk, branch]) {
      ctx.lineWidth = width * b.scale * (line === branch ? 0.7 : 1);
      ctx.beginPath();
      line.forEach((p, i) => {
        if (i === 0) ctx.moveTo(x0 + p.x, y0 + p.y);
        else ctx.lineTo(x0 + p.x, y0 + p.y);
      });
      ctx.stroke();
    }
  }
}

/**
 * The storm flash of the glass, baked at `flash.bakeShare` of its size: the sky lit a little, the storm clouds lit more
 * (the same clouds as in the glass), a bolt in the upper right pane; the sash bars and the kitchen valance stay dark.
 */
export function bakePanoramaFlash(scene: Phaser.Scene, place: StartPlaceId, key: string): void {
  const F = P.flash;
  const share = F.bakeShare;
  const m = PANORAMA_ART_MARGIN;
  bakeTexture(
    scene,
    key,
    Math.ceil(G.w * share) + 2 * m,
    Math.ceil(G.h * share) + 2 * m,
    () => undefined,
    (ctx) => {
      ctx.translate(m, m);
      ctx.scale(share, share);
      ctx.translate(-G.x, -G.y);
      ctx.save();
      panePath(ctx, place, 0);
      ctx.clip();
      const colour = cssColor(F.color);
      ctx.fillStyle = colour;
      ctx.globalAlpha = F.skyAlpha;
      ctx.fillRect(G.x, G.y, G.w, G.h);
      ctx.globalAlpha = F.cloudAlpha;
      const k = detailScale(G.h);
      for (const c of HEAVY_CLOUDS) cloud(ctx, G.x + G.w * c.x, G.y + G.h * c.y, c.s * k);
      ctx.globalAlpha = 1;
      paintFlashBolt(ctx);
      ctx.restore();
      cutFront(ctx, place, true);
    },
  );
}

/** Where the moon stands in the window picture: its centre as an offset from the picture's centre, its outer radius (drawn px). */
export function panoramaMoonOffset(): { x: number; y: number; r: number } {
  const spot = moonSpot(G);
  return { x: spot.x - P.width / 2, y: spot.y - P.height / 2, r: spot.r };
}

/**
 * The moon of the night panoramic window as a small picture of its own (baked at the window's `bakeScale`), so it can
 * leave before the window does: the glints of the glass lie over it, and in the kitchen the valance in front of it is cut out.
 */
export function bakePanoramaMoon(scene: Phaser.Scene, place: StartPlaceId, key: string): void {
  const spot = moonSpot(G);
  const m = PANORAMA_ART_MARGIN;
  const size = Math.ceil(2 * spot.r * P.bakeScale) + 2 * m;
  bakeTexture(
    scene,
    key,
    size,
    size,
    () => undefined,
    (ctx) => {
      ctx.translate(size / 2, size / 2);
      ctx.scale(P.bakeScale, P.bakeScale);
      ctx.translate(-spot.x, -spot.y);
      paintMoon(ctx, G);
      ctx.globalCompositeOperation = 'source-atop';
      paintGlints(ctx, G);
      ctx.globalCompositeOperation = 'source-over';
      cutFront(ctx, place, false);
    },
  );
}
