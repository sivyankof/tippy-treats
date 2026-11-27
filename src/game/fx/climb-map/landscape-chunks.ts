import type * as Phaser from 'phaser';
import { CLIMB_LANDSCAPE, type LandscapeKind } from '../../../data/progression/climb-landscape';
import { mixColor, shade } from '../../../util/color';
import { bakeTexture } from '../../ui/common/bake-texture';
import { drawKitchen, drawRoof, drawShowcase } from './landscape-house';
import type { LandCtx } from './landscape-kit';
import { LAND_H, climbStripWidth, landscapeKey, puffLayout, skyColorAt } from './landscape-math';
import { drawSign } from './landscape-signs';
import { drawClouds, drawCloudsScene, drawLapScene, drawStarsScene } from './landscape-sky';

const L = CLIMB_LANDSCAPE;

/** Which band a picture stands in, counted from the bottom (the laps follow the five zones). */
export function bandOf(kind: LandscapeKind, lap: number): number {
  const zones: Record<Exclude<LandscapeKind, 'lap'>, number> = {
    kitchen: 0,
    showcase: 1,
    roof: 2,
    clouds: 3,
    stars: 4,
  };
  return kind === 'lap' ? 4 + Math.max(1, lap) : zones[kind];
}

/** The colour filter of a shut picture: darker, then mostly fog, so only a silhouette stays. */
export function fogFilter(color: number): number {
  return mixColor(shade(color, L.fog.sink), L.fog.tone, L.fog.mix);
}

const identity = (color: number): number => color;

function drawSky(ctx: LandCtx, band: number): void {
  const row = L.skyRow;
  for (let y = 0; y < ctx.height; y += row) {
    ctx.g.fillStyle(skyColorAt(band + (ctx.height - (y + row / 2)) / ctx.height), 1);
    ctx.g.fillRect(0, y, ctx.width, row + 1);
  }
}

/** A shut picture melts into plain fog towards its foot, where the edge of the fog stands. */
function drawFootFade(ctx: LandCtx): void {
  const rows = Math.ceil(L.fog.footFade / L.skyRow);
  const start = ctx.height - L.fog.solidFoot - L.fog.footFade;
  for (let i = 0; i < rows; i++) {
    ctx.g.fillStyle(L.fog.tone, (i + 1) / rows);
    ctx.g.fillRect(0, start + i * L.skyRow, ctx.width, L.skyRow + 1);
  }
  ctx.g.fillStyle(L.fog.tone, 1);
  ctx.g.fillRect(0, ctx.height - L.fog.solidFoot, ctx.width, L.fog.solidFoot);
}

/** Draws the scene of a kind into `ctx` (the sky is already there). */
function drawScene(ctx: LandCtx, kind: LandscapeKind, lap: number): void {
  switch (kind) {
    case 'kitchen':
      return drawKitchen(ctx);
    case 'showcase':
      return drawShowcase(ctx);
    case 'roof':
      drawClouds(ctx, bandOf('roof', 0));
      return drawRoof(ctx);
    case 'clouds':
      return drawCloudsScene(ctx, bandOf('clouds', 0));
    case 'stars':
      drawClouds(ctx, bandOf('stars', 0));
      return drawStarsScene(ctx);
    case 'lap':
      return drawLapScene(ctx, lap);
  }
}

/**
 * Bakes the picture of one band of the ribbon (lazy: once per key) and returns its key. `shut`
 * pictures are drawn through the fog filter on plain fog: a silhouette of the scene under it and
 * a lock sign instead of the name.
 */
export function bakeLandscape(
  scene: Phaser.Scene,
  kind: LandscapeKind,
  lap: number,
  shut: boolean,
  foot = false,
): string {
  const key = landscapeKey(kind, lap, shut, foot);
  const band = bandOf(kind, lap);
  bakeTexture(scene, key, climbStripWidth(), LAND_H, (g) => {
    const ctx: LandCtx = {
      g,
      width: climbStripWidth(),
      height: LAND_H,
      c: shut ? fogFilter : identity,
    };
    if (shut) {
      g.fillStyle(L.fog.tone, 1);
      g.fillRect(0, 0, ctx.width, ctx.height);
    } else drawSky(ctx, band);
    drawScene(ctx, kind, lap);
    if (shut && foot) drawFootFade(ctx);
    drawSign(ctx, kind, shut);
  });
  return key;
}

export const FOG_FRONT_KEY = 'climb_map_fog_front';
export const FOG_BACK_KEY = 'climb_map_fog_back';

/** The puffs along the edge of the fog: a plain body above, round puffs hanging under it. */
function bakeFogEdge(scene: Phaser.Scene, key: string, seed: number, tone: number): void {
  const body = L.fog.tone;
  const f = L.fog;
  const width = climbStripWidth();
  const row = puffLayout(seed, width, f.puffs.count, f.puffs.radius);
  // Small puffs fill the dips between the big ones, so the edge is not a row of arcs.
  const puffs = [
    ...row,
    ...row.slice(1).map((b, i) => {
      const a = row[i] as (typeof row)[number];
      const r = Math.min(a.r, b.r) * 0.58;
      return { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + Math.min(a.r, b.r) * 0.62, r };
    }),
  ];
  const widest = f.puffs.radius[1];
  const base = f.edgeHeight - widest * 1.25;
  bakeTexture(scene, key, width, f.edgeHeight, (g) => {
    const outline = shade(tone, -0.16);
    g.fillStyle(outline, 1);
    for (const p of puffs) g.fillCircle(p.x, base + p.y, p.r + 4);
    g.fillStyle(shade(tone, -0.07), 1);
    for (const p of puffs) g.fillCircle(p.x, base + p.y, p.r);
    g.fillStyle(tone, 1);
    for (const p of puffs) g.fillCircle(p.x - p.r * 0.07, base + p.y - p.r * 0.1, p.r * 0.9);
    // The body joins the puffs: it covers their tops, so the outline shows only on the hanging part.
    g.fillStyle(body, 1);
    g.fillRect(0, 0, width, base);
    g.fillStyle(0xffffff, 0.5);
    for (const p of puffs.filter((_, i) => i % 2 === 0)) {
      g.fillEllipse(p.x - p.r * 0.35, base + p.y + p.r * 0.2, p.r * 0.34, p.r * 0.16);
    }
  });
}

/** Bakes the two edge pictures of the fog (lazy). */
export function bakeFogEdges(scene: Phaser.Scene): void {
  bakeFogEdge(scene, FOG_BACK_KEY, L.fog.backSeed, L.fog.toneLight);
  bakeFogEdge(scene, FOG_FRONT_KEY, L.fog.puffs.seed, L.fog.tone);
}

/** Bakes every picture the art sheet shows: each kind open, the shut ones and two laps. */
export function bakeLandscapeSheet(scene: Phaser.Scene): void {
  const kinds = ['kitchen', 'showcase', 'roof', 'clouds', 'stars'] as const;
  for (const kind of kinds) {
    bakeLandscape(scene, kind, 0, false);
    bakeLandscape(scene, kind, 0, true, true);
    bakeLandscape(scene, kind, 0, true);
  }
  for (const lap of [1, 2, 3]) bakeLandscape(scene, 'lap', lap, false);
  bakeLandscape(scene, 'lap', 1, true, true);
  bakeLandscape(scene, 'lap', 2, true);
  bakeFogEdges(scene);
}
