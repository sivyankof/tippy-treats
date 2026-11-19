import type * as Phaser from 'phaser';
import { ANIM } from '../../../data/common/anim';
import { RULE_ANIM } from '../../../data/zones/rule-anim';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { ZONE_RULES } from '../../../data/zones/zones';
import { clamp01, TWO_PI } from '../../../util/math';
import { flightClearBand, hudFloor } from '../../run/camera-layout';
import { bakeTexture } from '../../ui/common/bake-texture';
import { outlineColor } from '../common/plain-style';

/**
 * The figure of the cloud bank of the clouds zone (the nebula of Space is drawn by `nebula-arms.ts`):
 * ONE baked picture (a union of circles and one rounded body, so the outline runs round the whole
 * figure and no puff shows inside), not a row of puffs. On a short screen the top line is redrawn as
 * low puffs so that the figure stays clear of the HUD plates over the row.
 */

const cfg = RULE_ANIM.cloud;
const figure = cfg.figure;

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

/** A silhouette: the flat body and the circles that make its wavy edge. */
export interface Silhouette {
  body: BodyRect;
  /** The top line: domes that every tone pass follows. */
  circles: readonly Circle[];
  /** Lobes that bulge below or stick out: only the outline and the base tone take them, so the shade stays one flat band. */
  lobes: readonly Circle[];
  /** How much lower the lighter tones start under a squashed top of low puffs (see `squashTop`), baked px. */
  toneDip?: number;
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

/**
 * The highest screen y the top of a figure may move up to: `hudGapPx` under the lowest HUD plates (the
 * badge row, `hudFloor`), on every screen. On a short screen the figure at rest already reaches higher
 * (its flattened top over the cover row, the accepted case of 390x693): there it does not move up at all.
 */
export function topCeiling(): number {
  return hudFloor();
}

/** How far up a figure may move on a screen: the share of its bob and upward breath, and of its leave rise and growth. */
export interface VerticalRoom {
  billow: number;
  leave: number;
  /**
   * How far below the layer's height the figure stands, logical px: on a screen with no room even for the
   * layer's own bob (the bank takes the height the layer has at that moment), it stands that much lower;
   * the margin of the cover row still covers the layer.
   */
  drop: number;
}

/**
 * The vertical room of a figure whose top stands `topBaked` px above its centre: what is left between
 * its top at rest on the flight row and `topCeiling` goes first to the layer's own bob (the bank takes the
 * height the layer has when it comes; without room it stands lower by up to that bob, `drop`), then to the
 * figure's bob and upward breath, then to the rise and growth of the leave. A short screen with no room
 * keeps the figure from moving up at all: it fades instead of rising, so its top never comes nearer the
 * plates than it stands at rest. The room only grows with the screen height (monotonic).
 */
export function verticalRoom(screenH: number, topBaked: number): VerticalRoom {
  const top = topBaked * figure.scale;
  const bob = ANIM.flying.bobAmplitude;
  const free = flightRowY(screenH) - top - topCeiling();
  const drop = Math.min(bob, Math.max(0, bob - free));
  const slack = Math.max(0, free - bob);
  const billowNeed = cfg.bobPx + top * cfg.breathe;
  const billow = clamp01(slack / billowNeed);
  const left = Math.max(0, slack - billow * billowNeed);
  const leaveNeed = cfg.slidePx + top * (1 + cfg.breathe) * cfg.leaveGrow;
  return { billow, leave: clamp01(left / leaveNeed), drop };
}

/** How far the top of the cloud figure baked for a screen `screenH` tall stands above its centre (outline included), baked px. */
export function cloudTopBaked(screenH: number): number {
  const design = cloudSilhouette();
  const s = squashTop(design, topShare(design, riseRoom(screenH)));
  return figure.height / 2 - (silhouetteBounds(s).top - figure.outline);
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

/** A stretch of the top line made by one or more domes: from `a` to `b`, baked px, and how high its crest stands above the drawn body top. */
interface TopSpan {
  a: number;
  b: number;
  crest: number;
}

/** The stretches of the top line between `from` and `to`, one per dome that makes the top edge there. */
function topSpans(s: Silhouette, from: number, to: number): TopSpan[] {
  const spans: TopSpan[] = [];
  let owner: Circle | undefined;
  for (let x = Math.ceil(from); x <= to; x++) {
    let best: Circle | undefined;
    let top = TOP_BASE;
    for (const c of s.circles) {
      const half = arcHalf(c, Math.abs(x - c.x));
      if (half >= 0 && c.y - half < top) {
        top = c.y - half;
        best = c;
      }
    }
    const last = spans[spans.length - 1];
    if (best && best === owner && last) {
      last.b = x;
      last.crest = Math.max(last.crest, TOP_BASE - top);
    } else if (best) {
      spans.push({ a: x, b: x, crest: TOP_BASE - top });
    }
    owner = best;
  }
  return spans;
}

/** Joins every stretch narrower than `minSpan` to its narrower neighbour that touches it, so no crumb dome is left. */
function joinNarrow(spans: TopSpan[], minSpan: number): TopSpan[] {
  const out = spans.map((p) => ({ ...p }));
  for (;;) {
    let i = -1;
    for (let k = 0; k < out.length; k++) {
      const p = out[k];
      if (p && p.b - p.a < minSpan && (i < 0 || p.b - p.a < (out[i]?.b ?? 0) - (out[i]?.a ?? 0)))
        i = k;
    }
    const p = out[i];
    if (!p || out.length < 2) return out;
    const prev = out[i - 1];
    const next = out[i + 1];
    const touchesPrev = prev !== undefined && p.a - prev.b <= 1;
    const touchesNext = next !== undefined && next.a - p.b <= 1;
    let into: TopSpan | undefined;
    if (touchesPrev && touchesNext) into = prev.b - prev.a <= next.b - next.a ? prev : next;
    else into = touchesPrev ? prev : touchesNext ? next : undefined;
    if (into) {
      into.a = Math.min(into.a, p.a);
      into.b = Math.max(into.b, p.b);
      into.crest = Math.max(into.crest, p.crest);
    }
    out.splice(i, 1);
  }
}

/**
 * The silhouette with its top line squashed by `share` toward the drawn body top. The domes are redrawn
 * as low puffs standing on a line `lowPuffs.notchDip` under the drawn body top (the body top moves down to
 * it): each is as wide as the stretch of the line its dome made (so the puffs keep their different sizes
 * and every valley reaches down between them), and the wider and the taller the dome was, the higher its
 * puff, its crest at most `share` of the crest height above the drawn body top. The puffs are kept inside
 * the straight part of the top: no thin spit sticks out past the rounded ends of the body.
 */
export function squashTop(s: Silhouette, share: number): Silhouette {
  if (share >= 1) return s;
  const low = figure.lowPuffs;
  // From the line the domes stand on up to the highest crest the screen allows.
  const room = crestHeight(s) * share + low.notchDip;
  const base = TOP_BASE + low.notchDip;
  const corner = cornerRadius(s.body);
  const spans = joinNarrow(topSpans(s, s.body.left + corner, s.body.right - corner), low.minSpan);
  const widest = Math.max(...spans.map((p) => p.b - p.a));
  const tallest = Math.max(...spans.map((p) => p.crest));
  const circles: Circle[] = [];
  for (const p of spans) {
    const rx = (p.b - p.a) / 2;
    const size = Math.sqrt(((p.b - p.a) / widest) * (p.crest / tallest));
    const ry = Math.min(
      room * (low.heightFloor + (1 - low.heightFloor) * size),
      rx * low.aspect,
      p.crest + low.notchDip,
    );
    if (rx > 0 && ry > 0) circles.push({ x: (p.a + p.b) / 2, y: base, r: rx, ry });
  }
  return { ...s, body: { ...s.body, top: base }, circles, toneDip: low.toneDip };
}

/** The half-height of the arc of `c` at `dx` from its centre, or -1 outside it. */
function arcHalf(c: Circle, dx: number): number {
  if (dx >= c.r) return -1;
  return (c.ry ?? c.r) * Math.sqrt(1 - (dx * dx) / (c.r * c.r));
}

/** Where the bottom edge of a silhouette is at column `x` (the largest y covered). */
export function silhouetteBottomAt(s: Silhouette, x: number): number {
  let bottom = x >= s.body.left && x <= s.body.right ? s.body.bottom : -Infinity;
  for (const c of s.lobes) {
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
  return { left, right, top, bottom };
}

/**
 * Fills a circle or an ellipse grown by `grow` px and moved down by `drop`. A tone pass (`grow < 0`) over a
 * flat puff of a squashed top moves it with the top of its body (down by `drop - grow + dip`, see
 * `Silhouette.toneDip`) and stretches it up by `dip`, so the tones follow the low puffs instead of
 * flattening into a band.
 */
function fillLobe(
  g: Phaser.GameObjects.Graphics,
  c: Circle,
  grow: number,
  drop: number,
  dip = 0,
): void {
  if (c.ry === undefined) {
    if (c.r + grow > 0) g.fillCircle(c.x, c.y + drop, c.r + grow);
    return;
  }
  if (grow >= 0) {
    g.fillEllipse(c.x, c.y + drop, (c.r + grow) * 2, (c.ry + grow) * 2);
    return;
  }
  // A tone over a low puff keeps its width, so the puffs of a tone touch and the base tone shows only in the valleys.
  const ry = Math.min(c.ry + dip, c.r * figure.lowPuffs.aspect);
  g.fillEllipse(c.x, c.y + drop + dip - grow, c.r * 2, ry * 2);
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
  const dip = grow < 0 ? (s.toneDip ?? 0) : 0;
  for (const c of grow >= 0 ? [...s.circles, ...s.lobes] : s.circles)
    fillLobe(g, c, grow, drop, dip);
  const b = s.body;
  const w = b.right - b.left + grow * 2;
  const h = b.bottom - b.top + grow * 2 - dip;
  if (w <= 0 || h <= 0) return;
  g.fillRoundedRect(b.left - grow, b.top - grow + drop + dip, w, h, Math.min(h + dip, w) * 0.45);
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
