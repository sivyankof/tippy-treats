import type * as Phaser from 'phaser';
import {
  PLANET_COLORS,
  PLANET_DIM,
  PLANET_LOOK,
  SPACE_PLANET_IDS,
  planetDimKey,
  planetKey,
  type PlanetColors,
  type SpacePlanetId,
} from '../../../../data/zones/space-planets';
import { dimPixels, mixColor } from '../../../../util/color';
import { TWO_PI } from '../../../../util/math';
import {
  drawGlossMark,
  ellipsePoints,
  fillPolygon,
  outlineColor,
  type Pt,
} from '../../../fx/common/plain-style';
import { bakeTexture } from '../../../ui/bake-texture';

type Graphics = Phaser.GameObjects.Graphics;

const L = PLANET_LOOK;
const R = L.radius;
const OUTLINE = R * L.outlineShare;
/** Radius of the body inside its outline: details stay within it. */
const INNER = R - OUTLINE;
const SPRINKLES = [0xffffff, 0xffe27a, 0x8fe3ff, 0xb59cff];

/** A planet picture: where its body sits and how big the canvas is. */
interface Canvas {
  w: number;
  h: number;
  cx: number;
  cy: number;
}

const ROUND: Canvas = { w: L.size, h: L.size, cx: L.size / 2, cy: L.size / 2 };
const RINGED: Canvas = {
  w: L.ringedWidth,
  h: L.ringedHeight,
  cx: L.ringedWidth / 2,
  cy: L.ringedHeight / 2,
};

/** A planet's colours leaned towards the sky, so it reads as far away and stays below the tower in contrast. */
function muted(colors: PlanetColors): PlanetColors {
  const mute = (c: number): number => mixColor(c, L.muteTo, L.muteShare);
  const out: PlanetColors = {
    base: mute(colors.base),
    shade: mute(colors.shade),
    detail: mute(colors.detail),
    detailShade: mute(colors.detailShade),
  };
  if (colors.ring !== undefined) out.ring = mute(colors.ring);
  if (colors.ringShade !== undefined) out.ringShade = mute(colors.ringShade);
  return out;
}

/** The lower right of the body in the second tone: the body minus a copy of itself shifted to the upper left. */
function crescent(g: Graphics, cx: number, cy: number, r: number, color: number): void {
  const shift = r * L.crescentShift;
  const sx = cx - shift;
  const sy = cy - shift;
  const start = Math.PI * 1.25;
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i <= L.curveSteps; i++) {
    const a = start + (TWO_PI * i) / L.curveSteps;
    const p = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    if (Math.hypot(p.x - sx, p.y - sy) >= r) outer.push(p);
    const q = { x: sx + Math.cos(a) * r, y: sy + Math.sin(a) * r };
    if (Math.hypot(q.x - cx, q.y - cy) <= r) inner.push(q);
  }
  g.fillStyle(color, 1);
  fillPolygon(g, [...outer, ...inner.reverse()]);
}

/** The outlined round body with its second tone; returns the colour of its outline. */
function body(g: Graphics, c: Canvas, colors: PlanetColors): void {
  g.fillStyle(outlineColor(colors.base), 1);
  g.fillCircle(c.cx, c.cy, R);
  g.fillStyle(colors.base, 1);
  g.fillCircle(c.cx, c.cy, INNER);
  crescent(g, c.cx, c.cy, INNER, colors.shade);
}

function gloss(g: Graphics, c: Canvas): void {
  const k = L.gloss;
  drawGlossMark(g, {
    x: c.cx + k.x * R,
    y: c.cy + k.y * R,
    length: k.length * R,
    thick: k.thick * R,
    tilt: k.tilt,
    dotGap: k.dotGap * R,
    dotRadius: k.dotRadius * R,
    color: 0xffffff,
    alpha: L.glossAlpha,
  });
}

/** A band across the body, clipped to the disc; `wave` bends it, `slope` tilts it. */
function band(
  g: Graphics,
  c: Canvas,
  top: number,
  bottom: number,
  color: number,
  wave = { amp: 0, len: 1 },
  slope = 0,
): void {
  const upper: Pt[] = [];
  const lower: Pt[] = [];
  const steps = L.curveSteps;
  for (let i = 0; i <= steps; i++) {
    const x = -INNER + (2 * INNER * i) / steps;
    const edge = Math.sqrt(Math.max(INNER * INNER - x * x, 0));
    const bend = wave.amp * Math.sin((x / INNER) * Math.PI * wave.len) + slope * x;
    const y0 = Math.max(top + bend, -edge);
    const y1 = Math.min(bottom + bend, edge);
    const mid = (y0 + y1) / 2;
    upper.push({ x: c.cx + x, y: c.cy + (y0 < y1 ? y0 : mid) });
    lower.push({ x: c.cx + x, y: c.cy + (y0 < y1 ? y1 : mid) });
  }
  g.fillStyle(color, 1);
  fillPolygon(g, [...upper, ...lower.reverse()]);
}

function blob(
  g: Graphics,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rad: number,
  color: number,
): void {
  g.fillStyle(color, 1);
  fillPolygon(g, ellipsePoints(x, y, rx, ry, rad));
}

/** Points of the arc `from`..`to` (rad) of a tilted ellipse. */
function arc(c: Canvas, rx: number, ry: number, tilt: number, from: number, to: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= L.curveSteps; i++) {
    const a = from + ((to - from) * i) / L.curveSteps;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push({
      x: c.cx + x * Math.cos(tilt) - y * Math.sin(tilt),
      y: c.cy + x * Math.sin(tilt) + y * Math.cos(tilt),
    });
  }
  return out;
}

function stroke(g: Graphics, points: readonly Pt[], width: number, color: number, dy = 0): void {
  const [first, ...rest] = points;
  if (!first) return;
  g.lineStyle(width, color, 1);
  g.beginPath();
  g.moveTo(first.x, first.y + dy);
  for (const p of rest) g.lineTo(p.x, p.y + dy);
  g.strokePath();
}

/** A ring in the two tones with an outline: width `thick` px. */
function ringBand(
  g: Graphics,
  points: readonly Pt[],
  thick: number,
  colors: PlanetColors,
  outlined: boolean,
): void {
  const ring = colors.ring ?? colors.base;
  const shade = colors.ringShade ?? ring;
  if (outlined) stroke(g, points, thick + OUTLINE * 2, outlineColor(ring));
  stroke(g, points, thick, shade);
  stroke(g, points, thick * 0.6, ring, -thick * 0.18);
}

interface RingGeometry {
  rx: number;
  ry: number;
  tilt: number;
  thick: number;
}

function ringGeometry(thin = false): RingGeometry {
  const k = L.ring;
  return { rx: k.rx * R, ry: k.ry * R, tilt: k.tilt, thick: (thin ? k.thin : k.thick) * R };
}

/** The ring behind the body: the whole ellipse, outlined; the front half goes over the body later. */
function ringBack(g: Graphics, c: Canvas, ring: RingGeometry, colors: PlanetColors): Pt[] {
  ringBand(g, arc(c, ring.rx, ring.ry, ring.tilt, 0, TWO_PI), ring.thick, colors, true);
  return arc(c, ring.rx, ring.ry, ring.tilt, 0, Math.PI);
}

/** The near half of the ring, over the body: outline a little short of both ends so no seam shows. */
function ringFront(
  g: Graphics,
  c: Canvas,
  ring: RingGeometry,
  colors: PlanetColors,
  front: Pt[],
): void {
  const inset = L.ring.insetRad;
  const ring_ = colors.ring ?? colors.base;
  stroke(
    g,
    arc(c, ring.rx, ring.ry, ring.tilt, inset, Math.PI - inset),
    ring.thick + OUTLINE * 2,
    outlineColor(ring_),
  );
  ringBand(g, front, ring.thick, colors, false);
}

/** Small rounded dots on the front of the ring: sprinkles, sugar, drops. */
function ringDots(
  g: Graphics,
  c: Canvas,
  ring: RingGeometry,
  colors: PlanetColors,
  count: number,
): void {
  const pts = arc(c, ring.rx, ring.ry, ring.tilt, 0.28, Math.PI - 0.28);
  for (let i = 0; i < count; i++) {
    const p = pts[Math.round(((i + 0.5) / count) * (pts.length - 1))];
    if (!p) continue;
    const color = i % 2 === 0 ? colors.detail : (SPRINKLES[i % SPRINKLES.length] ?? colors.detail);
    blob(g, p.x, p.y - ring.thick * 0.1, ring.thick * 0.3, ring.thick * 0.11, (i % 3) - 1, color);
  }
}

function spiral(
  g: Graphics,
  c: Canvas,
  turns: number,
  width: number,
  color: number,
  phase: number,
): void {
  const points: Pt[] = [];
  const steps = L.curveSteps * turns;
  const reach = INNER - width / 2 - OUTLINE * 0.4;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = phase + TWO_PI * turns * t;
    points.push({ x: c.cx + Math.cos(a) * reach * t, y: c.cy + Math.sin(a) * reach * t });
  }
  stroke(g, points, width, color);
}

type Painter = (g: Graphics, colors: PlanetColors) => void;

const PAINTERS: Record<SpacePlanetId, { canvas: Canvas; paint: Painter }> = {
  marshmallow_moon: {
    canvas: ROUND,
    paint(g, k) {
      const c = ROUND;
      body(g, c, k);
      for (const [x, y, rx, ry, rot] of [
        [-0.2, 0.3, 0.2, 0.12, 0.4],
        [0.38, -0.08, 0.15, 0.09, -0.5],
        [0.1, -0.42, 0.12, 0.08, 0.2],
        [-0.5, -0.05, 0.1, 0.07, 0.9],
        [0.42, 0.42, 0.11, 0.07, -0.3],
      ] as const) {
        blob(g, c.cx + x * R, c.cy + y * R, rx * R, ry * R, rot, k.detail);
      }
      gloss(g, c);
    },
  },
  cookie: {
    canvas: ROUND,
    paint(g, k) {
      const c = ROUND;
      body(g, c, k);
      for (const [x, y, s, rot] of [
        [-0.3, -0.25, 0.2, 0.3],
        [0.32, -0.38, 0.14, -0.4],
        [0.42, 0.1, 0.18, 0.8],
        [-0.12, 0.2, 0.16, -0.2],
        [-0.5, 0.35, 0.12, 0.5],
        [0.1, 0.55, 0.14, 0.1],
        [0.05, -0.05, 0.1, 0.6],
      ] as const) {
        blob(g, c.cx + x * R, c.cy + y * R, s * R, s * R * 0.72, rot, k.detail);
        blob(
          g,
          c.cx + (x - 0.03) * R,
          c.cy + (y - 0.035) * R,
          s * R * 0.45,
          s * R * 0.25,
          rot,
          k.detailShade,
        );
      }
      gloss(g, c);
    },
  },
  caramel: {
    canvas: ROUND,
    paint(g, k) {
      const c = ROUND;
      body(g, c, k);
      const wave = { amp: 0.1 * R, len: 1.5 };
      band(g, c, -0.62 * R, -0.42 * R, k.detail, wave);
      band(g, c, -0.12 * R, 0.1 * R, k.detail, wave);
      band(g, c, 0.4 * R, 0.62 * R, k.detail, wave);
      band(g, c, 0.14 * R, 0.2 * R, k.detailShade, wave);
      gloss(g, c);
    },
  },
  donut_ring: {
    canvas: RINGED,
    paint(g, k) {
      const c = RINGED;
      const ring = ringGeometry();
      const front = ringBack(g, c, ring, k);
      body(g, c, k);
      // Glaze over the top, with a dripping lower edge.
      const drip = { amp: 0.1 * R, len: 2.5 };
      band(g, c, -INNER, -0.16 * R, k.detail, drip);
      band(g, c, -0.2 * R, -0.14 * R, k.detailShade, drip);
      for (const [x, y, rot, i] of [
        [-0.45, -0.6, 0.5, 0],
        [-0.1, -0.7, -0.4, 1],
        [0.3, -0.62, 0.9, 2],
        [0.55, -0.35, 0.1, 3],
        [-0.55, -0.32, -0.8, 1],
        [0.05, -0.38, 0.3, 2],
      ] as const) {
        blob(g, c.cx + x * R, c.cy + y * R, 0.09 * R, 0.035 * R, rot, SPRINKLES[i] ?? 0xffffff);
      }
      gloss(g, c);
      ringFront(g, c, ring, k, front);
      ringDots(g, c, ring, k, 7);
    },
  },
  mint_candy: {
    canvas: RINGED,
    paint(g, k) {
      const c = RINGED;
      const ring = ringGeometry(true);
      const front = ringBack(g, c, ring, k);
      body(g, c, k);
      for (const [from, to] of [
        [-0.95, -0.7],
        [-0.45, -0.2],
        [0.05, 0.3],
        [0.55, 0.8],
      ] as const) {
        band(g, c, from * R, to * R, k.detail, { amp: 0.04 * R, len: 1 }, 0.5);
      }
      gloss(g, c);
      ringFront(g, c, ring, k, front);
      ringDots(g, c, ring, k, 5);
    },
  },
  blueberry_jelly: {
    canvas: ROUND,
    paint(g, k) {
      const c = ROUND;
      body(g, c, k);
      // The little crown of a berry and glossy jelly bubbles.
      blob(g, c.cx + 0.38 * R, c.cy - 0.4 * R, 0.2 * R, 0.17 * R, 0.4, k.detailShade);
      blob(g, c.cx + 0.38 * R, c.cy - 0.4 * R, 0.09 * R, 0.07 * R, 0.4, k.shade);
      blob(g, c.cx - 0.1 * R, c.cy + 0.35 * R, 0.17 * R, 0.1 * R, -0.4, k.detail);
      blob(g, c.cx + 0.45 * R, c.cy + 0.28 * R, 0.1 * R, 0.07 * R, 0.8, k.detail);
      blob(g, c.cx - 0.5 * R, c.cy + 0.1 * R, 0.07 * R, 0.05 * R, 0.3, k.detail);
      gloss(g, c);
    },
  },
  cinnamon_galaxy: {
    canvas: ROUND,
    paint(g, k) {
      const c = ROUND;
      body(g, c, k);
      spiral(g, c, 2.2, 0.17 * R, k.detail, 0.4);
      spiral(g, c, 2.2, 0.08 * R, 0xfff0dc, 0.4 + 0.5);
      g.fillStyle(0xfff0dc, 1);
      g.fillCircle(c.cx, c.cy, 0.11 * R);
      g.fillStyle(k.detailShade, 1);
      g.fillCircle(c.cx, c.cy, 0.05 * R);
      gloss(g, c);
    },
  },
  cotton_galaxy: {
    canvas: ROUND,
    paint(g, k) {
      const c = ROUND;
      const lobes = [
        [-0.35, 0.15, 0.62, k.base],
        [0.3, -0.2, 0.6, k.base],
        [0.15, 0.4, 0.5, k.detail],
        [-0.25, -0.4, 0.45, k.detail],
        [0.05, 0, 0.55, k.base],
      ] as const;
      g.fillStyle(outlineColor(k.base), 1);
      for (const [x, y, s] of lobes)
        g.fillCircle(c.cx + x * R, c.cy + y * R, (s + L.outlineShare) * R);
      for (const [x, y, s, color] of lobes) {
        g.fillStyle(color, 1);
        g.fillCircle(c.cx + x * R, c.cy + y * R, s * R);
      }
      g.fillStyle(k.shade, 1);
      g.fillCircle(c.cx + 0.05 * R, c.cy + 0.02 * R, 0.22 * R);
      spiral(g, c, 1.6, 0.1 * R, 0xffffff, 1.2);
      gloss(g, c);
    },
  },
  truffle_hole: {
    canvas: RINGED,
    paint(g, k) {
      const c = RINGED;
      const ring = ringGeometry();
      const front = ringBack(g, c, ring, k);
      body(g, c, k);
      // Cocoa powder dusting.
      for (const [x, y, s] of [
        [-0.45, -0.3, 0.06],
        [-0.15, -0.55, 0.05],
        [0.3, -0.5, 0.07],
        [0.55, -0.1, 0.05],
        [-0.55, 0.1, 0.05],
        [0.4, 0.4, 0.06],
        [-0.2, 0.5, 0.05],
        [0.05, -0.25, 0.04],
      ] as const) {
        g.fillStyle(k.detail, 1);
        g.fillCircle(c.cx + x * R, c.cy + y * R, s * R);
      }
      gloss(g, c);
      ringFront(g, c, ring, k, front);
    },
  },
};

/** The size of the picture of a planet. */
export function planetSize(id: SpacePlanetId): { width: number; height: number } {
  const { w, h } = PAINTERS[id].canvas;
  return { width: w, height: h };
}

/**
 * Bakes the picture of one planet, once, and its muted copy (`planetDimKey`, `PLANET_DIM`), shown while the planet
 * is behind the flight row. Two textures, two bake steps: each step costs about what the planet alone did, so a
 * prep queue spreads them over two frames.
 */
export function bakePlanet(scene: Phaser.Scene, id: SpacePlanetId): void {
  const { canvas, paint } = PAINTERS[id];
  const colors = muted(PLANET_COLORS[id]);
  bakeTexture(scene, planetKey(id), canvas.w, canvas.h, (g) => paint(g, colors));
  bakeTexture(
    scene,
    planetDimKey(id),
    canvas.w,
    canvas.h,
    (g) => paint(g, colors),
    (context) => {
      const image = context.getImageData(0, 0, canvas.w, canvas.h);
      dimPixels(image.data, PLANET_DIM.saturation, PLANET_DIM.brightness);
      context.putImageData(image, 0, 0);
    },
  );
}

/** Bakes all nine (the art sheet shows them). */
export function bakeAllPlanets(scene: Phaser.Scene): void {
  for (const id of SPACE_PLANET_IDS) bakePlanet(scene, id);
}
