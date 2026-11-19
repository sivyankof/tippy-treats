import type * as Phaser from 'phaser';
import { PLAIN_TOPPERS } from '../../../data/toppers/plain-toppers';
import {
  SQUASH_PICTURES,
  SQUASH_TEXTURES,
  TOPPER_SQUASH,
} from '../../../data/toppers/topper-squash';
import { DEG_TO_RAD } from '../../../util/math';
import { bakeTexture } from '../../ui/common/bake-texture';
import { bakeCreamRollTextures } from './cream-roll-textures';
import {
  drawBlobs,
  drawGlossMark,
  drawTeardrop,
  ellipsePoints,
  fillOutlinedPolygon,
  fillPolygon,
  glossFromShares,
  outlineColor,
} from '../common/plain-style';
import { drawWafer, leaf } from './topper-texture';

const { stain } = TOPPER_SQUASH;
const { field, bake, outlinePx, stainColors, leafSize, waferBreak } = SQUASH_PICTURES;
const { gloss } = PLAIN_TOPPERS;

/** Size in layer pixels of a stain picture (the drawing and its field). */
export function stainPictureSize(): [number, number] {
  return [stain.width + field * 2, stain.height + field * 2];
}

/** The anchor of a stain as shares of its picture: the top of the blob. */
export function stainOrigin(): [number, number] {
  const [w, h] = stainPictureSize();
  return [(stain.originX * stain.width + field) / w, (stain.originY * stain.height + field) / h];
}

function glossAt(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  unit: number,
  color: number,
  alpha: number,
): void {
  drawGlossMark(g, glossFromShares({ ...gloss, x: 0, y: 0 }, x, y, unit, color, alpha));
}

type StainTones = (typeof stainColors)[keyof typeof stainColors];

/** The juice stain: a wide flat splash with a short drip running down, in the colours of the juice. */
function drawStain(g: Phaser.GameObjects.Graphics, tones: StainTones): void {
  const mid = stain.width / 2;
  const top = stain.originY * stain.height;
  drawBlobs(
    g,
    outlinePx,
    [
      { cx: mid, cy: top + 8, rx: 25, ry: 7.5 },
      { cx: mid - 21, cy: top + 10, rx: 8.5, ry: 5.2 },
      { cx: mid + 20, cy: top + 10.5, rx: 9, ry: 5.5 },
      { cx: mid + 6, cy: top + 3.5, rx: 12, ry: 4 },
      { cx: mid - 6, cy: top + 14, rx: 4.2, ry: 4.4 },
      { cx: mid - 6, cy: top + 17.5, rx: 3.6, ry: 3.6 },
    ],
    tones.base,
    tones.shadow,
    outlineColor(tones.shadow),
    0.12,
  );
  glossAt(g, mid - 11, top + 5, 30, tones.gloss, 0.95);
}

/** A flying drop of juice: a teardrop with an outline, drawn light and shown tinted (see `SQUASH_PICTURES.drop`). */
function drawDrop(g: Phaser.GameObjects.Graphics): void {
  const { width, height, outline, shadow } = SQUASH_PICTURES.drop;
  drawTeardrop(g, width, height, [outline, shadow, 0xffffff], outlinePx);
}

/** A drop of lemon juice: the same teardrop in its own colours. */
function drawLemonDrop(g: Phaser.GameObjects.Graphics): void {
  const { width, height, outline, body, light } = SQUASH_PICTURES.lemonDrop;
  drawTeardrop(g, width, height, [outline, body, light], outlinePx);
}

/** A strawberry seed: a small outlined teardrop, in its own colours. */
function drawSeed(g: Phaser.GameObjects.Graphics): void {
  const { width: w, height: h, color, dark } = SQUASH_PICTURES.seed;
  const cx = w / 2;
  const body = (grow: number): Array<{ x: number; y: number }> =>
    ellipsePoints(cx, h / 2, w / 2 - 1.2 + grow, h / 2 - 1.2 + grow, 0);
  g.fillStyle(dark, 1);
  fillPolygon(g, body(1.2));
  g.fillStyle(color, 1);
  fillPolygon(
    g,
    ellipsePoints(cx - 0.6, h / 2 - 0.6, (w / 2 - 1.2) * 0.75, (h / 2 - 1.2) * 0.8, 0),
  );
}

/** The bit of a cherry stem: a curved green stroke with a dark outline, in its own colours. */
function drawStemBit(g: Phaser.GameObjects.Graphics): void {
  const { width: w, height: h, thick, color, dark } = SQUASH_PICTURES.stem;
  const pad = thick / 2 + 1.5;
  const curve = (t: number): { x: number; y: number } => ({
    x: pad + (w - pad * 2) * t,
    y: h - pad - (h - pad * 2) * Math.sin(Math.PI * 0.5 * t) * (t < 0.5 ? 1 : 1 - (t - 0.5) * 0.8),
  });
  for (const [width, tone] of [
    [thick + outlinePx, dark],
    [thick, color],
  ] as const) {
    g.lineStyle(width, tone, 1);
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const p = curve(i / 12);
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.strokePath();
  }
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
  for (const [key, tones] of [
    [SQUASH_TEXTURES.stainCherry, stainColors.cherry],
    [SQUASH_TEXTURES.stainStrawberry, stainColors.strawberry],
  ] as const) {
    bakeTexture(scene, key, sw * bake, sh * bake, (g) => {
      g.scaleCanvas(bake, bake);
      g.translateCanvas(field, field);
      drawStain(g, tones);
    });
  }
  const { drop, lemonDrop, seed, stem: stemLook } = SQUASH_PICTURES;
  for (const [key, w, h, draw] of [
    [SQUASH_TEXTURES.drop, drop.width, drop.height, drawDrop],
    [SQUASH_TEXTURES.lemonDrop, lemonDrop.width, lemonDrop.height, drawLemonDrop],
    [SQUASH_TEXTURES.seed, seed.width, seed.height, drawSeed],
    [SQUASH_TEXTURES.stem, stemLook.width, stemLook.height, drawStemBit],
  ] as const) {
    bakeTexture(scene, key, (w + field * 2) * bake, (h + field * 2) * bake, (g) => {
      g.scaleCanvas(bake, bake);
      g.translateCanvas(field, field);
      draw(g);
    });
  }
  bakeCreamRollTextures(scene);
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
