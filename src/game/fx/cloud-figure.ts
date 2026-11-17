import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { RULE_ANIM } from '../../data/rule-anim';
import { LOGICAL_SIZE } from '../../data/screen';
import { ZONE_RULES } from '../../data/zones';
import { TWO_PI } from '../../util/math';
import { flightClearBand, hudFloor } from '../camera-layout';
import { bakeTexture } from '../ui/bake-texture';
import { outlineColor } from './plain-style';

/**
 * The figures of the cloud bank: the dense cloud of the clouds zone and the see-through nebula of
 * Space. Each is ONE baked picture (a union of circles and one rounded body, so the outline runs
 * round the whole figure and no puff shows inside), not a row of puffs. On a short screen the top
 * line is squashed toward the body so that the figure stays clear of the HUD plates over the row.
 */

const cfg = RULE_ANIM.cloud;
const figure = cfg.figure;
const curls = cfg.nebula.curls;

export interface Circle {
  x: number;
  y: number;
  r: number;
  /** Vertical radius when the circle is squashed into an ellipse (a short screen flattens the top line); `r` when absent. */
  ry?: number;
}

export interface BodyRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A silhouette: the flat body and the circles that make its wavy edge and its tails. */
export interface Silhouette {
  body: BodyRect;
  /** The top line: domes that every tone pass follows. */
  circles: readonly Circle[];
  /** Lobes and wisps that hang below or stick out: only the outline and the base tone take them, so the shade stays one flat band. */
  lobes: readonly Circle[];
  /** Soft tails that melt into transparency under the edge: no outline, drawn over the body. */
  wisps?: readonly Wisp[];
}

/** A wisp: the root bump (it is in `lobes` too and has the outline) and the fading lobes that drift off below it. */
export interface Wisp {
  root: Circle;
  tail: ReadonlyArray<Circle & { alpha: number }>;
}

/** The width (display px) the body must have to hide a layer anywhere on the screen at any moment of the cover. */
export function requiredBodyWidth(): number {
  // The layer can be anywhere on the screen; the figure sways, drifts on while it covers, and breathes.
  const moves = cfg.driftPx + cfg.swayPx + (cfg.driftSpeed * ZONE_RULES.clouds.coverMs[1]) / 1000;
  return (LOGICAL_SIZE.width + 2 * moves) / (1 - cfg.breathe);
}

/** The body of the figure in display px: how wide and how tall it hides the layer row. */
export function bodyDisplaySize(): { width: number; height: number } {
  const b = figure.body;
  return {
    width: (b.right - b.left) * figure.scale,
    height: (b.bottom - b.top) * figure.scale,
  };
}

/** Where the drawn body starts: `topDip` under `body.top`, the line the top bumps are squashed toward. */
export const TOP_BASE = figure.body.top + figure.topDip;

/** The drawn body: the cover body with its top `topDip` lower (the bumps of the top line close it). */
const DRAWN_BODY: BodyRect = { ...figure.body, top: TOP_BASE };

/** The cloud: a cumulus mass, two big domes with the tallest hump right of the middle, smaller bumps between, an uneven belly. */
export function cloudSilhouette(): Silhouette {
  return {
    body: DRAWN_BODY,
    circles: [
      // Domes of the top line, from the low left end to the tall hump and down to the right.
      { x: 150, y: 150, r: 55 },
      { x: 232, y: 140, r: 64 },
      { x: 330, y: 128, r: 98 },
      { x: 450, y: 150, r: 66 },
      { x: 560, y: 120, r: 82 },
      { x: 640, y: 116, r: 100 },
      { x: 760, y: 140, r: 70 },
      { x: 860, y: 150, r: 52 },
      { x: 925, y: 170, r: 38 },
    ],
    lobes: [
      // An uneven belly: a few flatter lobes of different depth, one hanging lower.
      { x: 205, y: 240, r: 38 },
      { x: 390, y: 244, r: 30 },
      { x: 560, y: 252, r: 52 },
      { x: 700, y: 242, r: 34 },
      { x: 850, y: 244, r: 26 },
    ],
  };
}

/** The wisps of the nebula: a small root bump and a few fainter lobes drifting off below it, each smaller than the last. */
function nebulaWisps(): Wisp[] {
  const w = cfg.nebula.wisps;
  const bottom = figure.body.bottom;
  return w.spots.map((spot) => {
    const tail: Array<Circle & { alpha: number }> = [];
    for (let i = 1; i <= spot.lobes; i++) {
      const r = spot.r * (1 - w.shrink * i);
      tail.push({
        x: spot.x + spot.drift * i,
        y: bottom + spot.len * i,
        r,
        ry: r * w.squash,
        alpha: w.lobeAlpha[i - 1] ?? 0,
      });
    }
    return { root: { x: spot.x, y: bottom - spot.r * w.rootLift, r: spot.r }, tail };
  });
}

/**
 * The bumps of the nebula's top line: x, radius and how far the crest stands above `body.top`, baked px.
 * Different sizes and heights, close enough to overlap above the body: no straight run on the top edge.
 */
const NEBULA_TOP: ReadonlyArray<readonly [number, number, number]> = [
  [80, 30, 6],
  [132, 36, 14],
  [186, 30, 12],
  [240, 40, 22],
  [296, 34, 16],
  [352, 44, 26],
  [410, 36, 20],
  [470, 50, 34],
  [532, 40, 26],
  [594, 46, 36],
  [654, 36, 24],
  [714, 42, 30],
  [772, 34, 18],
  [828, 36, 20],
  [880, 30, 10],
  [924, 26, 4],
];

/**
 * The nebula: a band of cotton wool about as thick all along. Its top is a bumpy cotton line a little
 * puffier than its underside; the underside is almost flat with a few short wisps that melt away.
 */
export function nebulaSilhouette(): Silhouette {
  const u = cfg.nebula.underside;
  const lobes: Circle[] = [];
  for (let x = u.from, i = 0; x <= u.to; x += u.step, i++) {
    const bottom = figure.body.bottom + (u.sag[i % u.sag.length] ?? 0);
    lobes.push({ x, y: bottom - u.r, r: u.r });
  }
  const wisps = nebulaWisps();
  return {
    body: DRAWN_BODY,
    circles: NEBULA_TOP.map(([x, r, rise]) => ({ x, y: figure.body.top - rise + r, r })),
    lobes: [...lobes, ...wisps.map((w) => w.root)],
    wisps,
  };
}

/** Screen y of the flight row on a tall tower (the highest it stands) on a screen `screenH` tall. */
export function flightRowY(screenH: number): number {
  const band = flightClearBand(screenH);
  return (band.top + band.bottom) / 2;
}

/**
 * How far the figure (its outline included) may reach above `body.top` on a screen `screenH` tall,
 * baked px: at the highest bob of the layer and of the figure and at the widest breath its top stays
 * `FLIGHT_CLEAR.hudGapPx` under the lowest HUD plate (`hudFloor`). Negative when even the body is closer.
 */
export function riseRoom(screenH: number): number {
  const highestCentre = flightRowY(screenH) - ANIM.flying.bobAmplitude - cfg.bobPx;
  const up = (highestCentre - hudFloor()) / (figure.scale * (1 + cfg.breathe));
  return up - (figure.height / 2 - figure.body.top) - figure.outline;
}

/** How high the crests of the top line stand above the drawn body top, baked px. */
function crestHeight(s: Silhouette): number {
  let crest = TOP_BASE;
  for (const c of s.circles) crest = Math.min(crest, c.y - (c.ry ?? c.r));
  return TOP_BASE - crest;
}

/**
 * The share the top line is squashed by toward the drawn body top so that it fits `room` (see `riseRoom`):
 * 1 keeps the drawn figure; the least leaves the crests at `body.top` and the bumps `topDip` deep, so the
 * line stays bumpy on the shortest screen while the cover row stays covered.
 */
export function topShare(s: Silhouette, room: number): number {
  const h = crestHeight(s);
  if (h <= 0) return 1;
  const least = figure.topDip / h;
  return Math.min(1, Math.max(least, (room + figure.topDip) / h));
}

/** Corner radius of a drawn body (the rounded rect of `fillSilhouette`). */
function cornerRadius(b: BodyRect): number {
  return Math.min(b.bottom - b.top, b.right - b.left) * 0.45;
}

/**
 * The silhouette with its top line squashed by `share` toward the drawn body top (circles become flat
 * ellipses). A flat ellipse no longer hides behind the rounded ends of the body, so it is kept inside
 * the straight part of the top (an end bump outside it is dropped): no thin spit sticks out at the ends.
 */
export function squashTop(s: Silhouette, share: number): Silhouette {
  if (share >= 1) return s;
  const corner = cornerRadius(s.body);
  const from = s.body.left + corner;
  const to = s.body.right - corner;
  const circles: Circle[] = [];
  for (const c of s.circles) {
    const r = Math.min(c.r, c.x - from, to - c.x);
    if (r <= 0) continue;
    circles.push({ x: c.x, y: TOP_BASE - (TOP_BASE - c.y) * share, r, ry: (c.ry ?? c.r) * share });
  }
  return { ...s, circles };
}

/** The half-height of the arc of `c` at `dx` from its centre, or -1 outside it. */
function arcHalf(c: Circle, dx: number): number {
  if (dx >= c.r) return -1;
  return (c.ry ?? c.r) * Math.sqrt(1 - (dx * dx) / (c.r * c.r));
}

/** Where the bottom edge of a silhouette is at column `x` (the largest y covered), wisps and their tails left out. */
export function silhouetteBottomAt(s: Silhouette, x: number): number {
  let bottom = x >= s.body.left && x <= s.body.right ? s.body.bottom : -Infinity;
  const roots = new Set(s.wisps?.map((w) => w.root));
  for (const c of s.lobes) {
    if (roots.has(c)) continue;
    const half = arcHalf(c, Math.abs(x - c.x));
    if (half >= 0) bottom = Math.max(bottom, c.y + half);
  }
  return bottom;
}

/** Where the top edge of a silhouette is at column `x` (the smallest y covered), for checking its profile. */
export function silhouetteTopAt(s: Silhouette, x: number): number {
  let top = x >= s.body.left && x <= s.body.right ? s.body.top : Infinity;
  for (const c of [...s.circles, ...s.lobes]) {
    const half = arcHalf(c, Math.abs(x - c.x));
    if (half >= 0) top = Math.min(top, c.y - half);
  }
  return top;
}

/** Everything that must lie inside the texture: its extreme points along the outline stroke. */
export function silhouetteBounds(s: Silhouette): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  let left = s.body.left;
  let right = s.body.right;
  let top = s.body.top;
  let bottom = s.body.bottom;
  for (const c of [...s.circles, ...s.lobes]) {
    left = Math.min(left, c.x - c.r);
    right = Math.max(right, c.x + c.r);
    top = Math.min(top, c.y - (c.ry ?? c.r));
    bottom = Math.max(bottom, c.y + (c.ry ?? c.r));
  }
  for (const w of s.wisps ?? []) {
    for (const c of w.tail) {
      left = Math.min(left, c.x - c.r);
      right = Math.max(right, c.x + c.r);
      bottom = Math.max(bottom, c.y + (c.ry ?? c.r));
    }
  }
  return { left, right, top, bottom };
}

/** Fills a circle or, when it is squashed, an ellipse grown by `grow` px. */
function fillLobe(g: Phaser.GameObjects.Graphics, c: Circle, grow: number, drop: number): void {
  const r = c.r + grow;
  const ry = (c.ry ?? c.r) + grow;
  if (r <= 0 || ry <= 0) return;
  if (c.ry === undefined) g.fillCircle(c.x, c.y + drop, r);
  else g.fillEllipse(c.x, c.y + drop, r * 2, ry * 2);
}

/** Fills a silhouette grown by `grow` px (shrunk when negative) and moved down by `drop`. */
function fillSilhouette(
  g: Phaser.GameObjects.Graphics,
  s: Silhouette,
  color: number,
  grow: number,
  drop: number,
): void {
  g.fillStyle(color, 1);
  // The lobes belong to the outline and the base tone only (`grow >= 0`).
  for (const c of grow >= 0 ? [...s.circles, ...s.lobes] : s.circles) fillLobe(g, c, grow, drop);
  const b = s.body;
  const w = b.right - b.left + grow * 2;
  const h = b.bottom - b.top + grow * 2;
  if (w <= 0 || h <= 0) return;
  g.fillRoundedRect(b.left - grow, b.top - grow + drop, w, h, Math.min(h, w) * 0.45);
}

/** A curl: a spiral stroke of `turns` turns that opens up to radius `r` around (`cx`, `cy`). */
function strokeCurl(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  turns: number,
  start: number,
  width: number,
  color: number,
): void {
  const steps = Math.ceil(turns * 24);
  g.lineStyle(width, color, 1);
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const a = start + k * turns * TWO_PI;
    const rr = r * (0.15 + 0.85 * k);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.8;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.strokePath();
}

/** The top share each figure was baked with: a figure is baked again when the screen height asks for another. */
const bakedShares = new Map<string, number>();

/**
 * Bakes a figure with its top squashed for the screen of `scene`. An existing picture is kept unless
 * `refresh` is set and the screen asks for another share (only at run load, when no bank shows it).
 */
function bakeFigure(
  scene: Phaser.Scene,
  key: string,
  design: Silhouette,
  draw: (g: Phaser.GameObjects.Graphics, s: Silhouette) => void,
  refresh: boolean,
): void {
  const share = topShare(design, riseRoom(scene.scale.height));
  if (scene.textures.exists(key)) {
    if (!refresh || bakedShares.get(key) === share) return;
    scene.textures.remove(key);
  }
  bakedShares.set(key, share);
  const s = squashTop(design, share);
  bakeTexture(scene, key, figure.width, figure.height, (g) => draw(g, s));
}

/** The cloud: white body, a pink rim light on top, a lilac belly and two lilac curls. */
export function bakeCloudFigure(scene: Phaser.Scene, key: string, refresh = false): void {
  const c = cfg.colors;
  const edge = outlineColor(c.lilac);
  bakeFigure(
    scene,
    key,
    cloudSilhouette(),
    (g, s) => {
      fillSilhouette(g, s, edge, figure.outline, 0);
      // Two tones: the lilac belly under everything, a pink rim light on top, the white body between.
      fillSilhouette(g, s, c.lilac, 0, 0);
      fillSilhouette(g, s, c.pink, -14, -14);
      fillSilhouette(g, s, c.white, -25, -3);
      strokeCurl(g, 330, 150, 42, 1.35, 0.4, 8, c.curl);
      strokeCurl(g, 640, 160, 46, 1.35, 3.4, 8, c.curl);
    },
    refresh,
  );
}

/** The nebula: pink body with a lighter top, a few pale round smears without an outline, soft wisps under it. */
export function bakeNebulaFigure(scene: Phaser.Scene, key: string, refresh = false): void {
  const n = cfg.nebula.colors;
  const edge = outlineColor(n.pink);
  bakeFigure(
    scene,
    key,
    nebulaSilhouette(),
    (g, s) => {
      fillSilhouette(g, s, edge, figure.outline, 0);
      fillSilhouette(g, s, n.pink, 0, 0);
      fillSilhouette(g, s, n.pinkLight, -16, -16);
      // The wisps: no outline, a few flat lobes, smaller and fainter down to the last.
      for (const w of s.wisps ?? []) {
        for (const c of w.tail) {
          g.fillStyle(n.pink, c.alpha);
          fillLobe(g, c, 0, 0);
        }
      }
      // A smear: one flat round stain, lighter than the pink under it.
      g.fillStyle(n.smear, 1);
      for (const m of cfg.nebula.smears) g.fillEllipse(m.x, m.y, m.w, m.h);
    },
    refresh,
  );
}

/** Size of the curl picture, baked px: the spiral with its stroke and a 3 px margin. */
export function curlPictureSize(): { width: number; height: number } {
  const pad = curls.width + 6;
  return { width: Math.ceil(curls.r * 2 + pad), height: Math.ceil(curls.r * 1.6 + pad) };
}

/** One white curl of the nebula, drawn over the figure as its own small picture (it reads white, not grey). */
export function bakeNebulaCurl(scene: Phaser.Scene, key: string): void {
  const { width, height } = curlPictureSize();
  bakeTexture(scene, key, width, height, (g) => {
    strokeCurl(g, width / 2, height / 2, curls.r, curls.turns, 0.2, curls.width, 0xffffff);
  });
}
