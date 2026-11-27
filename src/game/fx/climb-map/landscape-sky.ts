import { Rng } from '../../../core/common/rng';
import { BACKDROP_COLORS } from '../../../data/backdrop/backdrop-colors';
import { CLIMB_LANDSCAPE } from '../../../data/progression/climb-landscape';
import {
  PLANET_COLORS,
  type PlanetColors,
  type SpacePlanetId,
} from '../../../data/zones/space-planets';
import { shade } from '../../../util/color';
import {
  paintPlanet,
  planetCentre,
  planetSize,
} from '../../objects/backdrop/space/dessert-planets';
import {
  box,
  disc,
  drawBody,
  drawCloud,
  drawGroup,
  drawSparkle,
  gloss,
  ovalPart,
  type LandCtx,
} from './landscape-kit';
import { LAND_H, lapPlanet, planetSpot } from './landscape-math';

const L = CLIMB_LANDSCAPE;
const C = BACKDROP_COLORS;

/** A cloud of the ribbon, placed by its height from the foot of the ribbon (so it can stand over two pictures). */
interface CloudItem {
  x: number;
  /** Height of the centre above the foot of the ribbon, in bands. */
  at: number;
  scale: number;
  far: boolean;
}

/** The clouds of the climb: they begin over the roof, thicken in the Clouds and thin out into the night. */
function cloudItems(width: number): CloudItem[] {
  const rng = new Rng(11);
  const items: CloudItem[] = [];
  const first = 2.78;
  const count = 12;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const side = i % 2 === 0 ? 1 : -1;
    // The sign of the Clouds hangs on the left: no cloud stands behind it.
    if (side === -1 && i >= 3 && i <= 8) continue;
    items.push({
      x: width / 2 + side * rng.range(width * 0.12, width * 0.36),
      at: first + t * 1.42,
      scale: 1.25 - t * 0.35 + rng.range(-0.1, 0.1),
      far: t > 0.55,
    });
  }
  return items;
}

/** Draws the clouds that stand in (or reach into) band `band`. */
export function drawClouds(ctx: LandCtx, band: number): void {
  for (const item of cloudItems(ctx.width)) {
    const y = LAND_H * (band + 1 - item.at);
    const reach = 60 * item.scale;
    if (y < -reach || y > LAND_H + reach) continue;
    drawCloud(ctx, item.x, y, item.scale, item.far ? L.cloud.far : L.cloud.fill);
  }
}

/** Little stars over the picture; the first `share` of the height (from the top) is where they are. */
export function drawStars(
  ctx: LandCtx,
  seed: number,
  count: number,
  from = 16,
  to = LAND_H - 16,
): void {
  const rng = new Rng(seed);
  for (let i = 0; i < count; i++) {
    const x = rng.range(18, ctx.width - 18);
    const y = rng.range(from, to);
    const warm = rng.chance(0.3);
    if (rng.chance(0.55))
      drawSparkle(ctx, x, y, rng.range(5, 11), warm ? C.stars.warm : C.stars.star);
    else {
      ctx.g.fillStyle(ctx.c(warm ? C.stars.warm : C.stars.star), 0.9);
      ctx.g.fillCircle(x, y, rng.range(1.6, 3.2));
    }
  }
}

/** A hot-air balloon: an envelope with a gold band, ropes and a basket. */
function drawBalloon(ctx: LandCtx, cx: number, cy: number, s: number): void {
  const { g, c } = ctx;
  g.lineStyle(3, c(C.clouds.rope), 1);
  for (const dx of [-16, 16]) {
    g.beginPath();
    g.moveTo(cx + dx * s * 1.4, cy + 40 * s);
    g.lineTo(cx + dx * s, cy + 74 * s);
    g.strokePath();
  }
  drawBody(ctx, box(cx - 17 * s, cy + 72 * s, 34 * s, 26 * s, 0.25), C.clouds.basket, 3.5);
  drawGroup(
    ctx,
    [ovalPart(cx, cy - 6 * s, 44 * s, 52 * s), box(cx - 22 * s, cy + 28 * s, 44 * s, 22 * s, 0.4)],
    C.clouds.balloonA,
  );
  drawBody(ctx, ovalPart(cx, cy - 6 * s, 15 * s, 50 * s), C.clouds.balloonB, 3);
  gloss(ctx, cx - 24 * s, cy - 26 * s, 20 * s, 0.8);
}

/** The Clouds picture: the clouds on the sky plus a balloon. */
export function drawCloudsScene(ctx: LandCtx, band: number): void {
  drawStars(ctx, 31, 7, 14, 120);
  drawClouds(ctx, band);
  drawBalloon(ctx, 170, 62, 0.55);
}

/** A moon with a sleepy face. */
function drawMoon(ctx: LandCtx, cx: number, cy: number, r: number): void {
  drawBody(ctx, disc(cx, cy, r), C.stars.moon);
  for (const [dx, dy, k] of [
    [-0.45, -0.3, 0.14],
    [0.4, -0.5, 0.1],
    [0.5, 0.35, 0.12],
  ] as const) {
    drawBody(ctx, disc(cx + dx * r, cy + dy * r, k * r), C.stars.moonCrater, 2);
  }
  const { g, c } = ctx;
  g.fillStyle(c(C.stars.moonFace), 1);
  g.fillCircle(cx - r * 0.3, cy + r * 0.05, r * 0.07);
  g.fillCircle(cx + r * 0.3, cy + r * 0.05, r * 0.07);
  g.lineStyle(r * 0.06, c(C.stars.moonFace), 1);
  g.beginPath();
  g.arc(cx, cy + r * 0.12, r * 0.2, 0.2, Math.PI - 0.2, false);
  g.strokePath();
  g.fillStyle(c(C.stars.moonCheek), 0.7);
  g.fillEllipse(cx - r * 0.5, cy + r * 0.25, r * 0.22, r * 0.14);
  g.fillEllipse(cx + r * 0.5, cy + r * 0.25, r * 0.22, r * 0.14);
  gloss(ctx, cx - r * 0.45, cy - r * 0.55, r * 0.32, 0.8);
}

/** The Stars picture: many stars and a moon. */
export function drawStarsScene(ctx: LandCtx): void {
  drawStars(ctx, 41, L.lap.stars + 14);
  drawMoon(ctx, 150, 68, 44);
}

/** The colours of a planet seen through the filter of the picture. */
function planetColors(id: SpacePlanetId, c: (color: number) => number): PlanetColors {
  const k = PLANET_COLORS[id];
  const out: PlanetColors = {
    base: c(k.base),
    shade: c(k.shade),
    detail: c(k.detail),
    detailShade: c(k.detailShade),
  };
  if (k.ring !== undefined) out.ring = c(k.ring);
  if (k.ringShade !== undefined) out.ringShade = c(k.ringShade);
  return out;
}

/** A shooting star: a bright head and a tail that thins. */
function drawComet(ctx: LandCtx, x: number, y: number, len: number): void {
  const { g, c } = ctx;
  for (let i = 0; i < 6; i++) {
    g.fillStyle(c(C.space.cometTail), 0.75 - i * 0.1);
    g.fillCircle(x - (len * (i + 1)) / 6, y - (len * (i + 1)) / 12, 7 - i);
  }
  drawBody(ctx, disc(x, y, 8), C.space.cometHead, 2.5);
}

/** A soft nebula: stacked flat ellipses, each a little smaller, so the middle is the brightest. */
function drawNebula(
  ctx: LandCtx,
  cx: number,
  cy: number,
  w: number,
  h: number,
  color: number,
): void {
  const n = L.lap.nebula;
  for (let i = 0; i < n.layers; i++) {
    const k = 1 - i / n.layers;
    ctx.g.fillStyle(ctx.c(color), n.layerAlpha);
    ctx.g.fillEllipse(cx, cy, w * k, h * k);
  }
}

/** A lap of Space: night sky with a dusting of stars, soft nebulae and the planet of the lap in the left column. */
export function drawLapScene(ctx: LandCtx, lap: number): void {
  const rng = new Rng(97 + lap * 13);
  const { g, c } = ctx;
  const n = L.lap.nebula;
  for (let i = 0; i < n.count; i++) {
    const color = L.lap.colors[(lap + i) % L.lap.colors.length] ?? C.space.nebulaA;
    drawNebula(
      ctx,
      rng.range(260, ctx.width - 120),
      rng.range(70, LAND_H - 70),
      rng.range(...n.width),
      rng.range(...n.height),
      color,
    );
  }
  drawStars(ctx, 211 + lap * 7, L.lap.stars);
  const id = lapPlanet(lap);
  const extra = lap % 3;
  const size = planetSize(id);
  const spot = planetSpot(
    lap,
    size.width,
    size.height,
    PLANET_COLORS[id].ring !== undefined,
    extra === 0,
  );
  const centre = planetCentre(id);
  g.save();
  g.translateCanvas(spot.x - centre.x * spot.scale, spot.y - centre.y * spot.scale);
  g.scaleCanvas(spot.scale, spot.scale);
  paintPlanet(g, id, planetColors(id, c));
  g.restore();
  // Each lap keeps one more detail of its own, in the left column or just left of the tower.
  const k = L.lap.comet;
  if (extra === 0) drawComet(ctx, k.x, k.y, k.tail);
  else if (extra === 1) {
    drawBody(ctx, disc(294, 74, 14), shade(0xc9b8ff, -0.05));
    drawBody(ctx, disc(313, 98, 7), 0xffe3a8, 3);
  } else {
    drawSparkle(ctx, 290, 60, 18, C.stars.warm);
    drawSparkle(ctx, 306, 104, 11, C.stars.star);
  }
}
