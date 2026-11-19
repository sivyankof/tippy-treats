import type * as Phaser from 'phaser';
import { PLAIN_TOPPERS } from '../../../data/toppers/plain-toppers';
import { SQUASH_PICTURES, SQUASH_TEXTURES } from '../../../data/toppers/topper-squash';
import { DEG_TO_RAD } from '../../../util/math';
import { bakeTexture } from '../../ui/bake-texture';
import {
  drawGlossMark,
  ellipsePoints,
  fillPolygon,
  glossFromShares,
  type Blob,
  type Pt,
} from '../common/plain-style';
import { creamDropPictureSize, ridgePictureSize } from './topper-squash-plan';

const { field, bake, cream } = SQUASH_PICTURES;
const { tones } = cream;

type Ridge = (typeof cream.ridges)[keyof typeof cream.ridges];

/** The lit part of a festoon: the oval a little smaller, up and to the left, so its shade shows below and on the right. */
function litOf(b: Readonly<Blob>): Blob {
  const k = cream.band;
  return { cx: b.cx - b.rx * k * 0.7, cy: b.cy - b.ry * k, rx: b.rx * (1 - k), ry: b.ry * (1 - k) };
}

/** The light rim over the top of an oval: a band between its upper arc and the same arc lowered by `share` of its height. */
function rimOf(b: Readonly<Blob>): Pt[] {
  const { share, fromDeg, toDeg } = cream.rim;
  const drop = b.ry * share;
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let deg = fromDeg; deg <= toDeg; deg += 10) {
    const a = deg * DEG_TO_RAD;
    // The band thins out towards its ends, so it never shows as a hard step on the sides.
    const end = Math.sin(((deg - fromDeg) / (toDeg - fromDeg)) * Math.PI);
    outer.push({ x: b.cx + Math.cos(a) * b.rx, y: b.cy + Math.sin(a) * b.ry });
    inner.push({ x: b.cx + Math.cos(a) * b.rx, y: b.cy + Math.sin(a) * b.ry + drop * end });
  }
  return [...outer, ...inner.reverse()];
}

/**
 * A ridge of cream piped along the seam: a flat base and festoons on it from big to small, the
 * warm outline around all of them, a shade under each, a light rim over each festoon and the gloss
 * on one. Neutral greys: the overlay tint gives the colour of the layer's cream.
 */
function drawRidge(g: Phaser.GameObjects.Graphics, ridge: Ridge): void {
  const o = cream.outlinePx;
  const blobs: readonly Blob[] = [ridge.base, ...ridge.festoons];
  g.fillStyle(tones.outline, 1);
  for (const b of blobs) fillPolygon(g, ellipsePoints(b.cx, b.cy, b.rx + o, b.ry + o, 0));
  g.fillStyle(tones.shade, 1);
  for (const b of blobs) fillPolygon(g, ellipsePoints(b.cx, b.cy, b.rx, b.ry, 0));
  // The base keeps a flat band of shade along its bottom; each festoon covers the rim of the one before it.
  const base = ridge.base;
  g.fillStyle(tones.base, 1);
  fillPolygon(g, ellipsePoints(base.cx, base.cy - base.ry * 0.25, base.rx - 1, base.ry * 0.82, 0));
  for (const b of ridge.festoons) {
    const lit = litOf(b);
    g.fillStyle(tones.base, 1);
    fillPolygon(g, ellipsePoints(lit.cx, lit.cy, lit.rx, lit.ry, 0));
    g.fillStyle(tones.light, 1);
    fillPolygon(g, rimOf(lit));
  }
  // A swirl crease over each festoon but the bead at the end: the piped look.
  g.lineStyle(cream.crease.widthPx, tones.shade, 1);
  for (const b of ridge.festoons.slice(0, -1)) {
    const lit = litOf(b);
    g.beginPath();
    for (let i = 0; i <= CREASE_STEPS; i++) {
      const p = creasePoint(lit, i / CREASE_STEPS);
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.strokePath();
  }
  const shine = litOf(ridge.festoons[ridge.glossOn]!);
  drawGlossMark(
    g,
    glossFromShares(
      { ...PLAIN_TOPPERS.gloss, x: 0, y: 0 },
      shine.cx - shine.rx * 0.38,
      shine.cy - shine.ry * 0.36,
      shine.ry * cream.glossUnit,
      tones.gloss,
      1,
    ),
  );
}

const CREASE_STEPS = 8;

/** A point `t` (0..1) along the swirl crease of a festoon: from its upper left down to its lower right, bowed up. */
function creasePoint(b: Readonly<Blob>, t: number): Pt {
  const p0 = { x: b.cx - b.rx * 0.2, y: b.cy - b.ry * 0.62 };
  const p1 = { x: b.cx + b.rx * 0.45, y: b.cy - b.ry * 0.25 };
  const p2 = { x: b.cx + b.rx * 0.55, y: b.cy + b.ry * 0.5 };
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

/** Where the neck meets the bulb, as a share of the bulb radius. */
const NECK_FOOT = 0.92;

/** A drop of cream hanging from the ridge: a neck and a round bulb, the outline, the shade, the base and a white spot. */
function drawCreamDrop(g: Phaser.GameObjects.Graphics): void {
  const { width: w, height: h, neck } = cream.drop;
  const o = cream.outlinePx * 0.85;
  const r = w / 2 - o;
  const bulbY = h - w / 2;
  const half = r * neck;
  const shape = (grow: number, dx: number, dy: number): void => {
    fillPolygon(g, ellipsePoints(w / 2 + dx, bulbY + dy, r + grow, r + grow, 0));
    // The neck runs from the top of the picture down into the bulb, widening as it goes.
    const cx = w / 2 + dx;
    const top = o + dy - grow;
    fillPolygon(g, [
      { x: cx - half - grow, y: top },
      { x: cx + half + grow, y: top },
      { x: cx + (r + grow) * NECK_FOOT, y: bulbY + dy },
      { x: cx - (r + grow) * NECK_FOOT, y: bulbY + dy },
    ]);
  };
  g.fillStyle(tones.outline, 1);
  shape(o, 0, 0);
  g.fillStyle(tones.shade, 1);
  shape(0, 0, 0);
  g.fillStyle(tones.base, 1);
  shape(-1.4, -0.8, -1);
  g.fillStyle(tones.gloss, 1);
  g.fillCircle(w / 2 - r * 0.38, bulbY - r * 0.3, r * 0.22);
}

/** Bakes the pictures of the cream roll (once): two ridges and the drop. */
export function bakeCreamRollTextures(scene: Phaser.Scene): void {
  const [rw, rh] = ridgePictureSize();
  for (const [key, ridge] of [
    [SQUASH_TEXTURES.creamRidgeA, cream.ridges.a],
    [SQUASH_TEXTURES.creamRidgeB, cream.ridges.b],
  ] as const) {
    bakeTexture(scene, key, rw * bake, rh * bake, (g) => {
      g.scaleCanvas(bake, bake);
      g.translateCanvas(field, field);
      drawRidge(g, ridge);
    });
  }
  const [dw, dh] = creamDropPictureSize();
  bakeTexture(scene, SQUASH_TEXTURES.creamDrop, dw * bake, dh * bake, (g) => {
    g.scaleCanvas(bake, bake);
    g.translateCanvas(field, field);
    drawCreamDrop(g);
  });
}
