import type * as Phaser from 'phaser';
import { PLAIN_LAYER } from '../../data/plain-layers';
import { PLAIN_TOPPERS } from '../../data/plain-toppers';
import { SQUASH_PICTURES, SQUASH_TEXTURES, TOPPER_SQUASH } from '../../data/topper-squash';
import { DEG_TO_RAD } from '../../util/math';
import { bakeTexture } from '../ui/bake-texture';
import {
  drawGlossMark,
  drawTwoToneBody,
  ellipsePoints,
  fillOutlinedPolygon,
  fillPolygon,
  glossFromShares,
  outlineColor,
  roundRectPoints,
  type BodyShape,
} from './plain-style';
import { drawWafer, leaf } from './topper-texture';

const { stain, roll } = TOPPER_SQUASH;
const { field, bake, outlinePx, rollOutlinePx, stainColors, leafSize, waferBreak } =
  SQUASH_PICTURES;
const { gloss } = PLAIN_TOPPERS;

/** Size in layer pixels of a stain picture (the drawing and its field). */
export function stainPictureSize(): [number, number] {
  return [stain.width + field * 2, stain.height + field * 2];
}

/** Size in layer pixels of a cream roll picture. */
export function rollPictureSize(): [number, number] {
  return [roll.width + field * 2, roll.height + field * 2];
}

/** The anchor of a stain as shares of its picture: the top of the blob. */
export function stainOrigin(): [number, number] {
  const [w, h] = stainPictureSize();
  return [(stain.originX * stain.width + field) / w, (stain.originY * stain.height + field) / h];
}

/** The anchor of a roll as shares of its picture: the end tucked under the upper layer. */
export function rollOrigin(): [number, number] {
  const [w, h] = rollPictureSize();
  return [(roll.originX * roll.width + field) / w, (roll.originY * roll.height + field) / h];
}

interface Blob {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** A blob drawn as ellipses: one outline pass, one shadow pass and one lit pass over all of them, so the parts melt into one body. */
function drawBlobs(
  g: Phaser.GameObjects.Graphics,
  blobs: readonly Blob[],
  base: number,
  shadow: number,
  band: number,
): void {
  g.fillStyle(outlineColor(base), 1);
  for (const b of blobs)
    fillPolygon(g, ellipsePoints(b.cx, b.cy, b.rx + outlinePx, b.ry + outlinePx, 0));
  g.fillStyle(shadow, 1);
  for (const b of blobs) fillPolygon(g, ellipsePoints(b.cx, b.cy, b.rx, b.ry, 0));
  g.fillStyle(base, 1);
  for (const b of blobs) {
    fillPolygon(
      g,
      ellipsePoints(
        b.cx - b.rx * band,
        b.cy - b.ry * band,
        b.rx * (1 - band),
        b.ry * (1 - band),
        0,
      ),
    );
  }
}

function glossAt(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  unit: number,
  alpha: number,
): void {
  drawGlossMark(g, glossFromShares({ ...gloss, x: 0, y: 0 }, x, y, unit, stainColors.gloss, alpha));
}

/** The juice stain: a splat with a drip running down. Drawn light, shown tinted in the colour of the juice. */
function drawStain(g: Phaser.GameObjects.Graphics): void {
  const { width: w } = stain;
  const mid = w / 2;
  const top = stain.originY * stain.height;
  drawBlobs(
    g,
    [
      { cx: mid, cy: top + 12, rx: 21, ry: 12 },
      { cx: mid - 17, cy: top + 15, rx: 9, ry: 7.5 },
      { cx: mid + 16, cy: top + 16, rx: 9.5, ry: 8 },
      { cx: mid + 4, cy: top + 6, rx: 11, ry: 6 },
      { cx: mid - 4, cy: top + 27, rx: 5.2, ry: 7 },
      { cx: mid - 4, cy: top + 33, rx: 6, ry: 6.2 },
    ],
    stainColors.base,
    stainColors.shadow,
    0.12,
  );
  glossAt(g, mid - 8, top + 6, 36, 0.95);
  glossAt(g, mid - 6, top + 31, 9, 0.9);
}

const capsule: BodyShape = (cx, cy, rx, ry) => roundRectPoints(cx, cy, rx, ry, ry);

/** The cream roll squeezed out between two layers: a plump capsule with two ridges. */
function drawCreamRoll(g: Phaser.GameObjects.Graphics): void {
  const { color, shadow } = PLAIN_LAYER.decor.cream;
  const cx = roll.width / 2;
  const cy = roll.height / 2;
  const rx = roll.width / 2 - rollOutlinePx;
  const ry = roll.height / 2 - rollOutlinePx;
  drawTwoToneBody(g, capsule, cx, cy, rx, ry, {
    base: color,
    shadow,
    grow: rollOutlinePx,
    band: 0.14,
  });
  g.lineStyle(3, shadow, 1);
  for (const x of [cx - rx * 0.1, cx + rx * 0.42]) {
    g.beginPath();
    g.moveTo(x - 3, cy - ry * 0.8);
    g.lineTo(x + 3, cy + ry * 0.8);
    g.strokePath();
  }
  drawGlossMark(
    g,
    glossFromShares(
      { ...gloss, x: 0, y: 0 },
      cx - rx * 0.45,
      cy - ry * 0.4,
      roll.height * 1.5,
      0xffffff,
      gloss.alpha,
    ),
  );
}

/** A mint leaf that came off the topper: two tones, a vein, the outline of the toppers. */
function drawLeaf(g: Phaser.GameObjects.Graphics): void {
  const c = PLAIN_TOPPERS.colors.mint;
  const hub = { x: leafSize.width / 2, y: leafSize.height - field };
  fillOutlinedPolygon(
    g,
    leaf(hub, 0, leafSize.length, leafSize.half),
    c.base,
    outlineColor(c.base),
    outlinePx,
  );
  g.fillStyle(c.shadow, 1);
  fillPolygon(
    g,
    leaf(hub, 0, leafSize.length * 0.96, leafSize.half * 0.34).map((p) => ({
      x: p.x + 1.6,
      y: p.y + 1.6,
    })),
  );
  g.lineStyle(1.8, c.vein, 1);
  g.beginPath();
  g.moveTo(hub.x, hub.y);
  g.lineTo(hub.x, hub.y - leafSize.length * 0.8);
  g.strokePath();
}

/**
 * One half of the wafer tube, the picture of the whole topper with the other half erased along a
 * jagged break: the two halves share the picture and the anchor of the topper, so at the first
 * frame they sit exactly where the whole wafer stood.
 */
function bakeWaferHalf(scene: Phaser.Scene, key: string, keep: 'top' | 'bottom'): void {
  const { width, height, field: pad, restY } = PLAIN_TOPPERS.kinds.wafer;
  const s = PLAIN_TOPPERS.bakeScale * PLAIN_TOPPERS.showScale;
  const fullW = width + pad.left + pad.right;
  const fullH = height + pad.top + pad.bottom;
  const tilt = waferBreak.tiltDeg * DEG_TO_RAD;
  // The tube lies at its own tilt: `up` runs along it, `across` runs over the break.
  const up = { x: Math.sin(tilt), y: -Math.cos(tilt) };
  const across = { x: Math.cos(tilt), y: Math.sin(tilt) };
  const centre = {
    x: (width / 2 + pad.left) * s,
    y: (restY - waferBreak.centreAboveRest + pad.top) * s,
  };
  const edge: Array<{ x: number; y: number }> = [];
  const half = waferBreak.halfWidth * s;
  const step = waferBreak.zigStep * s;
  for (let t = -half, i = 0; t <= half + 0.01; t += step, i++) {
    const zig = (i % 2 === 0 ? 1 : -1) * waferBreak.zig * s;
    edge.push({
      x: centre.x + across.x * t + up.x * zig,
      y: centre.y + across.y * t + up.y * zig,
    });
  }
  bakeTexture(
    scene,
    key,
    fullW * s,
    fullH * s,
    (g) => {
      g.scaleCanvas(s, s);
      g.translateCanvas(pad.left, pad.top);
      drawWafer(g);
    },
    (ctx) => {
      const far = 200 * s;
      const away = keep === 'top' ? -1 : 1;
      const first = edge[0]!;
      const last = edge[edge.length - 1]!;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(first.x + across.x * far * -1, first.y + across.y * far * -1);
      ctx.lineTo(first.x, first.y);
      for (const p of edge) ctx.lineTo(p.x, p.y);
      ctx.lineTo(last.x + across.x * far, last.y + across.y * far);
      ctx.lineTo(
        last.x + across.x * far + up.x * far * away,
        last.y + across.y * far + up.y * far * away,
      );
      ctx.lineTo(
        first.x - across.x * far + up.x * far * away,
        first.y - across.y * far + up.y * far * away,
      );
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // The broken end shows the dark inside of the wafer along the jagged edge.
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.strokeStyle = `#${PLAIN_TOPPERS.colors.wafer.inside.toString(16).padStart(6, '0')}`;
      ctx.lineWidth = waferBreak.insideLine * s;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      edge.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
    },
  );
}

/** Bakes the pictures of the squash (once); the art sheet shows them. */
export function bakeSquashTextures(scene: Phaser.Scene): void {
  const [sw, sh] = stainPictureSize();
  bakeTexture(scene, SQUASH_TEXTURES.stain, sw * bake, sh * bake, (g) => {
    g.scaleCanvas(bake, bake);
    g.translateCanvas(field, field);
    drawStain(g);
  });
  const [rw, rh] = rollPictureSize();
  bakeTexture(scene, SQUASH_TEXTURES.creamRoll, rw * bake, rh * bake, (g) => {
    g.scaleCanvas(bake, bake);
    g.translateCanvas(field, field);
    drawCreamRoll(g);
  });
  bakeTexture(
    scene,
    SQUASH_TEXTURES.leaf,
    (leafSize.width + field * 2) * bake,
    (leafSize.height + field * 2) * bake,
    (g) => {
      g.scaleCanvas(bake, bake);
      g.translateCanvas(field, field);
      drawLeaf(g);
    },
  );
  bakeWaferHalf(scene, SQUASH_TEXTURES.waferTop, 'top');
  bakeWaferHalf(scene, SQUASH_TEXTURES.waferBottom, 'bottom');
}
