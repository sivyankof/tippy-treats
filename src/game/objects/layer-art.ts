import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { LAYER_COLORS, PALETTE, type LayerColors } from '../../data/palette';
import { mixColor, shade } from '../../util/color';
import { bakeTexture } from '../ui/bake-texture';

const DARK_OUTLINE = -0.38;
const GLAZE_OUTLINE = -0.22;
const PORE_SHADE = -0.3;
/** Pores sit between these shares of the sponge strip width, measured from the cut edge. */
const PORE_NEAR = 0.3;
const PORE_FAR = 0.7;
/** Golden ratio step: spreads the pores evenly without a random generator. */
const PORE_STEP = 0.618;
const DRIP_WIDTH = 22;
const DRIP_MIN_LAYER_WIDTH = 120;
const DRIP_SHORT_RATIO = 0.65;
const GLOSS_HEIGHT = 10;
const GLOSS_INSET = 26;
const GLOSS_LENGTH_RATIO = 0.5;
const SHADOW_DROP = 6;
const SHADOW_WIDTH_RATIO = 0.96;
const RIM_SHARE = 0.26;
/** Empty pixels around the art so antialiased edges are not cut. */
const SIDE_PAD = 2;
/** Space under the layer for its shadow. */
const SHADOW_MARGIN = Math.ceil(SHADOW_DROP + ANIM.layer.shadowHeight / 2) + 1;

/** Index into the colour table for a 1-based layer number. */
export function colorIndexFor(layerIndex: number): number {
  const n = LAYER_COLORS.length;
  return (((layerIndex - 1) % n) + n) % n;
}

/** Colours of the layers with this colour-table index (see `colorIndexFor`). */
export function layerColors(colorIndex: number): LayerColors {
  return LAYER_COLORS[colorIndex] ?? LAYER_COLORS[0]!;
}

/** Whole-pixel width the art is baked at. */
export function artWidth(width: number): number {
  return Math.max(1, Math.round(width));
}

/**
 * Top-anchored stack of bands, lighter towards the top. The bands are nested
 * from tall to short, so the colour changes from `bottom` to `top` going up.
 * Band bottoms are square, which only shows below the rounded top corners.
 */
function fillGradient(
  g: Phaser.GameObjects.Graphics,
  box: { x: number; y: number; width: number; height: number },
  radius: number,
  bottom: number,
  top: number,
  bands: number,
): void {
  const minHeight = Math.min(box.height, radius);
  const corners = { tl: radius, tr: radius, bl: 0, br: 0 };
  for (let k = 0; k < bands; k++) {
    const t = bands === 1 ? 0 : k / (bands - 1);
    const height = minHeight + (box.height - minHeight) * (1 - k / bands);
    g.fillStyle(mixColor(bottom, top, t), 1);
    g.fillRoundedRect(box.x, box.y, box.width, height, corners);
  }
}

function drawGlaze(
  g: Phaser.GameObjects.Graphics,
  width: number,
  colors: LayerColors,
  box: { left: number; innerLeft: number; innerTop: number; innerW: number; innerRadius: number },
): void {
  const { outline, glazeDepth, dripCount, dripLength, gradientLift, glazeBands } = ANIM.layer;
  const glazeH = BALANCE.layer.height * glazeDepth;
  const withDrips = width >= DRIP_MIN_LAYER_WIDTH;
  const topCorners = { tl: box.innerRadius, tr: box.innerRadius, bl: 0, br: 0 };

  // Two passes so every outline sits under every fill.
  for (const pass of ['outline', 'fill'] as const) {
    const grow = pass === 'outline' ? outline / 2 : 0;
    if (pass === 'outline') {
      g.fillStyle(shade(colors.glaze, GLAZE_OUTLINE), 1);
      g.fillRoundedRect(
        box.innerLeft - grow,
        box.innerTop - grow,
        box.innerW + grow * 2,
        glazeH + grow,
        topCorners,
      );
    } else {
      fillGradient(
        g,
        { x: box.innerLeft, y: box.innerTop, width: box.innerW, height: glazeH },
        box.innerRadius,
        colors.glaze,
        shade(colors.glaze, gradientLift),
        glazeBands,
      );
    }
    if (!withDrips) continue;
    g.fillStyle(pass === 'outline' ? shade(colors.glaze, GLAZE_OUTLINE) : colors.glaze, 1);
    for (let i = 0; i < dripCount; i++) {
      const cx = box.left + (width * (i + 1)) / (dripCount + 1);
      const length = i % 2 === 0 ? dripLength : dripLength * DRIP_SHORT_RATIO;
      const w = DRIP_WIDTH + grow * 2;
      g.fillRoundedRect(
        cx - w / 2,
        box.innerTop + glazeH - DRIP_WIDTH / 2,
        w,
        length + DRIP_WIDTH / 2 + grow,
        w / 2,
      );
    }
  }
}

/**
 * Porous sponge on the cut side: a lighter strip along the inner side of the edge,
 * over the glaze too, with a few darker pores. Drawn inside the outline.
 */
function drawSponge(
  g: Phaser.GameObjects.Graphics,
  cut: CutSide,
  colors: LayerColors,
  box: { innerLeft: number; innerTop: number; innerW: number; innerH: number; innerRadius: number },
): void {
  const { width, lift, poreCount, poreRadius, poreAlpha } = ANIM.layer.sponge;
  const stripW = Math.min(width, box.innerW / 2);
  if (stripW <= 0) return;
  const sign = cut === 'left' ? 1 : -1;
  const edgeX = cut === 'left' ? box.innerLeft : box.innerLeft + box.innerW;
  const stripLeft = cut === 'left' ? edgeX : edgeX - stripW;
  const r = box.innerRadius;
  const corners = cut === 'left' ? { tl: r, tr: 0, bl: r, br: 0 } : { tl: 0, tr: r, bl: 0, br: r };

  g.fillStyle(shade(colors.cake, lift), 1);
  g.fillRoundedRect(stripLeft, box.innerTop, stripW, box.innerH, corners);

  g.fillStyle(shade(colors.cake, PORE_SHADE), poreAlpha);
  for (let i = 0; i < poreCount; i++) {
    const y = box.innerTop + (box.innerH * (i + 0.5)) / poreCount;
    const along = PORE_NEAR + (PORE_FAR - PORE_NEAR) * ((i * PORE_STEP) % 1);
    g.fillCircle(edgeX + sign * stripW * along, y, poreRadius);
  }
}

/** Draws shadow, body, glaze with drips and gloss around the origin of `g`. */
function drawLayer(
  g: Phaser.GameObjects.Graphics,
  width: number,
  colors: LayerColors,
  cut: CutSide | null,
): void {
  const h = BALANCE.layer.height;
  const { outline, cornerRadius, bodyBands, gradientLift } = ANIM.layer;
  const left = -width / 2;
  const top = -h / 2;
  const radius = Math.min(cornerRadius, width / 2, h / 2);
  const innerRadius = Math.max(0, radius - outline);
  const innerLeft = left + outline;
  const innerTop = top + outline;
  const innerW = Math.max(0, width - outline * 2);
  const innerH = h - outline * 2;

  g.fillStyle(PALETTE.textDark, ANIM.layer.shadowAlpha);
  g.fillEllipse(0, h / 2 + SHADOW_DROP, width * SHADOW_WIDTH_RATIO, ANIM.layer.shadowHeight);

  // Body: dark outline, darker rim at the bottom, a gradient of cake above it.
  g.fillStyle(shade(colors.cake, DARK_OUTLINE), 1);
  g.fillRoundedRect(left, top, width, h, radius);
  g.fillStyle(shade(colors.cake, -ANIM.layer.rimAlpha), 1);
  g.fillRoundedRect(innerLeft, innerTop, innerW, innerH, innerRadius);
  fillGradient(
    g,
    { x: innerLeft, y: innerTop, width: innerW, height: innerH * (1 - RIM_SHARE) },
    innerRadius,
    colors.cake,
    shade(colors.cake, gradientLift),
    bodyBands,
  );

  drawGlaze(g, width, colors, { left, innerLeft, innerTop, innerW, innerRadius });
  if (cut) drawSponge(g, cut, colors, { innerLeft, innerTop, innerW, innerH, innerRadius });

  const glossW = Math.max(0, width * GLOSS_LENGTH_RATIO - GLOSS_INSET);
  if (glossW > 0) {
    g.fillStyle(PALETTE.textLight, ANIM.layer.glossAlpha);
    g.fillRoundedRect(
      left + GLOSS_INSET,
      top + outline + GLOSS_HEIGHT,
      glossW,
      GLOSS_HEIGHT,
      GLOSS_HEIGHT / 2,
    );
  }
}

// Baked layer textures are shared by every view. A texture is kept while any view
// shows it; unused ones stay for a while (widths repeat after perfect landings) and
// the oldest are removed beyond ANIM.pool.idleLayerTextures. Map order is use order.
const refs = new Map<string, number>();

const CUT_SUFFIX: Readonly<Record<CutSide | 'none', string>> = { none: 'n', left: 'l', right: 'r' };

/**
 * Bakes (or finds) the art for a colour, width and cut side (`null`: an intact layer)
 * and counts one more user of it.
 */
export function acquireLayerArt(
  scene: Phaser.Scene,
  colorIndex: number,
  width: number,
  cut: CutSide | null,
): string {
  const w = artWidth(width);
  const key = `layer_${colorIndex}_${w}_${CUT_SUFFIX[cut ?? 'none']}`;
  const texW = 2 * Math.ceil((w + SIDE_PAD * 2) / 2);
  const texH = BALANCE.layer.height + SHADOW_MARGIN * 2;
  const colors = layerColors(colorIndex);
  bakeTexture(scene, key, texW, texH, (g) => {
    g.translateCanvas(texW / 2, texH / 2);
    drawLayer(g, w, colors, cut);
  });
  const users = refs.get(key) ?? 0;
  refs.delete(key);
  refs.set(key, users + 1);
  return key;
}

/** Gives a texture back; unused textures beyond the idle limit are removed. */
export function releaseLayerArt(scene: Phaser.Scene, key: string): void {
  const users = refs.get(key);
  if (users === undefined) return;
  refs.set(key, users - 1);
  let idle = [...refs].filter(([, count]) => count <= 0);
  for (const [oldKey] of idle) {
    if (idle.length <= ANIM.pool.idleLayerTextures) break;
    refs.delete(oldKey);
    scene.textures.remove(oldKey);
    idle = idle.filter(([k]) => k !== oldKey);
  }
}
