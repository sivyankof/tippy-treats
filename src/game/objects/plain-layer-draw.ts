import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import { PLAIN_LAYER, type DecorKind, type SpongeLook } from '../../data/plain-layers';
import { PALETTE, type LayerColors } from '../../data/palette';
import { mixColor, shade } from '../../util/color';
import { GOLDEN } from '../../util/math';
import { faceHalfSpan } from '../fx/glaze-growth';
import { drawDecor } from './decor-draw';
import { decorItems } from './decor-layout';
import { cutStripWidth, glazeWave, waveEdge, type GlazeWave } from './glaze-wave';
import { drawShadow, fillGradient, layerBox, type LayerBox } from './layer-draw';
import { innerInsetAt, spongePores } from './sponge-pores';

/** Everything a plain (or golden) layer is drawn from. */
export interface PlainArt {
  colors: LayerColors;
  sponge: SpongeLook;
  decor: DecorKind | null;
}

/** Rows of the polygon that follows the rounded inner corners. */
const SLICE_STEP = 2;
/** Pores of a bitten edge sit between these shares of the strip width. */
const CUT_PORE_NEAR = 0.3;
const CUT_PORE_SPAN = 0.4;

/**
 * Fills the part of the inner area between `y1` and `y2` (and between `xMin` and `xMax`) with
 * the current fill style, following the rounded inner corners.
 */
function fillInnerSlice(
  g: Phaser.GameObjects.Graphics,
  box: LayerBox,
  y1: number,
  y2: number,
  xMin = -Infinity,
  xMax = Infinity,
): void {
  const top = Math.max(y1, box.innerTop);
  const bottom = Math.min(y2, box.innerBottom);
  if (bottom <= top) return;
  const rows: number[] = [];
  for (let y = top; y < bottom; y += SLICE_STEP) rows.push(y);
  rows.push(bottom);
  const leftAt = (y: number): number => Math.max(xMin, box.innerLeft + innerInsetAt(box, y));
  const rightAt = (y: number): number => Math.min(xMax, box.innerRight - innerInsetAt(box, y));
  g.beginPath();
  rows.forEach((y, i) => (i === 0 ? g.moveTo(leftAt(y), y) : g.lineTo(leftAt(y), y)));
  for (let i = rows.length - 1; i >= 0; i--) g.lineTo(rightAt(rows[i]!), rows[i]!);
  g.closePath();
  g.fillPath();
}

/** Warm outline, a lighter top and a soft darker band at the bottom. */
function drawSpongeBody(g: Phaser.GameObjects.Graphics, box: LayerBox, sponge: SpongeLook): void {
  const { bandShare, bandMix, bandSteps, lift, bands } = PLAIN_LAYER.body;
  const cake = sponge.cake;
  g.fillStyle(sponge.outline, 1);
  g.fillRoundedRect(box.left, box.top, box.width, box.height, box.radius);
  g.fillStyle(cake, 1);
  g.fillRoundedRect(box.innerLeft, box.innerTop, box.innerW, box.innerH, box.innerRadius);
  fillGradient(
    g,
    {
      x: box.innerLeft,
      y: box.innerTop,
      width: box.innerW,
      height: Math.max(0, box.innerH - box.innerRadius),
    },
    box.innerRadius,
    cake,
    shade(cake, lift),
    bands,
  );
  const bandH = box.innerH * bandShare;
  for (let s = 0; s < bandSteps; s++) {
    g.fillStyle(mixColor(cake, sponge.pore, (bandMix * (s + 1)) / bandSteps), 1);
    fillInnerSlice(g, box, box.innerBottom - bandH * (1 - s / bandSteps), box.innerBottom);
  }
}

/** The lighter sponge of a bitten edge, under the cut glaze, with a few pores. */
function drawCutFace(
  g: Phaser.GameObjects.Graphics,
  box: LayerBox,
  cut: CutSide,
  sponge: SpongeLook,
  wave: GlazeWave,
): void {
  const strip = cutStripWidth(box);
  if (strip <= 0) return;
  const { lift, poreCount } = PLAIN_LAYER.cut;
  const x0 = cut === 'left' ? box.innerLeft : box.innerRight - strip;
  g.fillStyle(shade(sponge.cake, lift), 1);
  fillInnerSlice(g, box, wave.crestY, box.innerBottom, x0, x0 + strip);
  g.fillStyle(sponge.pore, PLAIN_LAYER.pores.alpha);
  const radii = PLAIN_LAYER.pores.radii;
  const height = box.innerBottom - wave.crestY;
  for (let i = 0; i < poreCount; i++) {
    const y = wave.crestY + (height * (i + 0.5)) / poreCount;
    const along = CUT_PORE_NEAR + CUT_PORE_SPAN * (((i + 1) * GOLDEN) % 1);
    g.fillCircle(x0 + strip * along, y, radii[i % radii.length]!);
  }
}

/** Glaze over the top with a wavy lower edge and a darker line under that edge. */
function drawWavyGlaze(
  g: Phaser.GameObjects.Graphics,
  box: LayerBox,
  glaze: number,
  wave: GlazeWave,
): void {
  const spec = PLAIN_LAYER.glaze;
  // The edge over the whole inner width: flat at the crest over a bitten edge's sponge.
  const edge: number[] = [];
  if (wave.left > box.innerLeft) edge.push(box.innerLeft, wave.crestY);
  edge.push(...waveEdge(wave));
  if (edge.length === 0) edge.push(wave.left, wave.crestY, wave.right, wave.crestY);
  if (wave.right < box.innerRight) edge.push(box.innerRight, wave.crestY);
  const lip = wave.crestY - 1;

  for (const [color, drop] of [
    [shade(glaze, spec.outlineShade), spec.outlinePx],
    [glaze, 0],
  ] as const) {
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(box.innerLeft, lip);
    for (let i = 0; i < edge.length; i += 2) g.lineTo(edge[i]!, edge[i + 1]! + drop);
    g.lineTo(box.innerRight, lip);
    g.closePath();
    g.fillPath();
  }
  fillGradient(
    g,
    { x: box.innerLeft, y: box.innerTop, width: box.innerW, height: lip - box.innerTop + 1 },
    box.innerRadius,
    glaze,
    shade(glaze, spec.lift),
    spec.bands,
  );
}

/** A long white streak along the top of the glaze and a short dash after it. */
function drawGlazeGloss(g: Phaser.GameObjects.Graphics, box: LayerBox, wave: GlazeWave): void {
  const { inset, y, height, lengthShare, maxLength, gap, dash, alpha } = PLAIN_LAYER.gloss;
  const x0 = wave.left + inset;
  const room = wave.right - inset - x0;
  const length = Math.min(maxLength, box.width * lengthShare, room);
  if (length < height) return;
  g.fillStyle(PALETTE.textLight, alpha);
  g.fillRoundedRect(x0, box.innerTop + y, length, height, height / 2);
  if (length + gap + dash <= room) {
    g.fillRoundedRect(x0 + length + gap, box.innerTop + y, dash, height, height / 2);
  }
}

/**
 * Shadow, sponge with pores, wavy glaze with gloss, the bitten edge and the decorations. A
 * `faceless` piece (bitten off) has no face to keep clear: it is decorated to the middle.
 */
export function drawPlainLayer(
  g: Phaser.GameObjects.Graphics,
  width: number,
  art: PlainArt,
  cut: CutSide | null,
  faceless = false,
): void {
  const box = layerBox(width);
  const faceHalf = faceless ? null : faceHalfSpan(width, null);
  const wave = glazeWave(box, cut, faceHalf);
  drawShadow(g, box);
  drawSpongeBody(g, box, art.sponge);
  g.fillStyle(art.sponge.pore, PLAIN_LAYER.pores.alpha);
  for (const pore of spongePores(box, cut, faceHalf, wave.crestY)) {
    g.fillCircle(pore.x, pore.y, pore.r);
  }
  if (cut) drawCutFace(g, box, cut, art.sponge, wave);
  drawWavyGlaze(g, box, art.colors.glaze, wave);
  drawGlazeGloss(g, box, wave);
  if (art.decor) drawDecor(g, art.decor, decorItems(art.decor, box, cut, faceHalf));
}
