import type * as Phaser from 'phaser';
import { CLIMB_LANDSCAPE, type LandscapeKind } from '../../../data/progression/climb-landscape';
import { mixColor, shade } from '../../../util/color';
import { bakeTexture } from '../../ui/common/bake-texture';
import { drawKitchen, drawRoof, drawShowcase } from './landscape-house';
import type { LandCtx } from './landscape-kit';
import {
  LAND_H,
  climbStripWidth,
  landscapeKey,
  lapLook,
  puffLayout,
  skyColorAt,
  type Puff,
} from './landscape-math';
import { Rng } from '../../../core/common/rng';
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
): string {
  const key = landscapeKey(kind, lap, shut);
  // Laps share their picture with the lap nine below (`lapLook`): draw the look, not the lap.
  const look = kind === 'lap' ? lapLook(lap) : lap;
  const band = bandOf(kind, look);
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
    drawScene(ctx, kind, look);
    drawSign(ctx, kind, shut);
  });
  return key;
}

export const FOG_FRONT_KEY = 'climb_map_fog_front';
export const FOG_BACK_KEY = 'climb_map_fog_back';

/** A row of puffs for the top or the fringe of the bank: the two ends stand on the frame so the bank ends round. */
function puffRow(seed: number, width: number): Puff[] {
  const f = L.fog;
  const row = puffLayout(seed, width, f.puffs.count, f.puffs.radius);
  const first = row[0];
  const last = row[row.length - 1];
  if (first) first.x = 0;
  if (last) last.x = width;
  return row;
}

/** Small puffs that fill the dips between the big ones. */
function dips(row: readonly Puff[]): Puff[] {
  return row.slice(1).map((b, i) => {
    const a = row[i] as Puff;
    const small = Math.min(a.r, b.r);
    const { radius, drop } = L.fog.dip;
    return { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + small * drop, r: small * radius };
  });
}

/**
 * One bank of the fog edge: a bumpy top, a body with soft patches and a fringe of puffs hanging
 * lower here and there. The ends stand on the frame. One picture, drawn once.
 */
function bakeFogEdge(scene: Phaser.Scene, key: string, seed: number, tone: number): void {
  const f = L.fog;
  const width = climbStripWidth();
  const height = f.edgeHeight;
  const topBase = f.topBase;
  const fringeBase = height - f.fringeInset;
  const topRow = puffRow(seed + 3, width).map((p) => ({ ...p, y: p.y * 0.6 }));
  const fringe = puffRow(seed, width).map((p, i) =>
    i % f.dropEvery === 1 ? { ...p, y: p.y + f.dropExtra, r: p.r + 4 } : p,
  );
  const bottom = [...fringe, ...dips(fringe)];
  const rng = new Rng(seed + 29);
  bakeTexture(scene, key, width, height, (g) => {
    const outline = shade(tone, -0.16);
    const rows = [
      { base: topBase, puffs: topRow },
      { base: fringeBase, puffs: bottom },
    ];
    g.fillStyle(outline, 1);
    for (const { base, puffs } of rows)
      for (const p of puffs) g.fillCircle(p.x, base + p.y, p.r + 4);
    g.fillStyle(shade(tone, -0.07), 1);
    for (const { base, puffs } of rows) for (const p of puffs) g.fillCircle(p.x, base + p.y, p.r);
    g.fillStyle(tone, 1);
    for (const { base, puffs } of rows) {
      for (const p of puffs) g.fillCircle(p.x - p.r * 0.07, base + p.y - p.r * 0.1, p.r * 0.9);
    }
    // The body joins the two rows: it covers the lower halves of the top bumps and the upper halves of the fringe.
    g.fillStyle(tone, 1);
    g.fillRect(0, topBase, width, fringeBase - topBase);
    // Soft patches, so the body is not one flat tint.
    for (let i = 0; i < f.patches.count; i++) {
      g.fillStyle(shade(tone, i % 2 === 0 ? f.patches.shade : -f.patches.shade), f.patches.alpha);
      g.fillEllipse(
        rng.range(0, width),
        rng.range(topBase, fringeBase),
        rng.range(...f.patches.width),
        rng.range(...f.patches.height),
      );
    }
    g.fillStyle(0xffffff, 0.5);
    for (const p of topRow.filter((_, i) => i % 2 === 0)) {
      g.fillEllipse(p.x - p.r * 0.38, topBase + p.y - p.r * 0.45, p.r * 0.34, p.r * 0.16);
    }
    for (const p of fringe.filter((_, i) => i % 2 === 1)) {
      g.fillEllipse(p.x - p.r * 0.35, fringeBase + p.y + p.r * 0.2, p.r * 0.34, p.r * 0.16);
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
    bakeLandscape(scene, kind, 0, true);
  }
  for (const lap of [1, 2, 3]) bakeLandscape(scene, 'lap', lap, false);
  bakeLandscape(scene, 'lap', 2, true);
  bakeFogEdges(scene);
}
