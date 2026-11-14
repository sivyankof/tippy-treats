import type * as Phaser from 'phaser';
import { GLAZE_DRIPS } from '../../data/glaze-drips';
import { PALETTE } from '../../data/palette';
import { shade } from '../../util/color';
import { bakeTexture } from '../ui/bake-texture';
import { GLAZE_OUTLINE } from './layer-draw';

/** Size of a drip: stem width, diameter of the round end and outline, in pixels. */
export interface DripSize {
  stem: number;
  bulb: number;
  outline: number;
}

/** Texture keys of the drip pictures of one glaze colour and size. */
export interface DripTextureSet {
  /** A short slice of the stem (outline, glaze, highlight stripe), stretched along the drip. */
  stem: string;
  /** The round end with a neck as wide as the stem on top; height = width. */
  bulb: string;
  /** A falling drop: round bottom, pointed top. */
  drop: string;
  /** The flat spot a drop leaves where it lands. */
  spot: string;
}

/** Height of the stem slice: it is stretched to any length. */
export const STEM_SLICE = 4;
/** The falling drop is this share of the round end; its height is `DROP_TALL` times its width. */
const DROP_SHARE = 0.8;
const DROP_TALL = 1.35;
/** A small extra droplet beside the spot, as shares of the spot size. */
const SATELLITE = { x: 0.92, y: 0.25, r: 0.14 } as const;

const look = GLAZE_DRIPS.look;

/** Outer width of a drip picture of this size (the round end and its outline). */
export function bulbOuter(size: DripSize): number {
  return size.bulb + size.outline * 2;
}

/** Outer width of the stem picture. */
export function stemOuter(size: DripSize): number {
  return size.stem + size.outline * 2;
}

/** Outer width and height of the falling drop. */
export function dropOuter(size: DripSize): { width: number; height: number } {
  const width = size.bulb * DROP_SHARE + size.outline * 2;
  return { width, height: width * DROP_TALL };
}

function keyOf(kind: string, size: DripSize, color: number): string {
  return `glaze_drip_${kind}_${Math.round(size.stem * 10)}_${color.toString(16)}`;
}

/** The highlight stripe of the stem and the neck: x of its left edge and its width, from the left of a picture `outer` wide. */
function stripe(size: DripSize, outer: number): { x: number; w: number } {
  const w = size.stem * look.stripeWidth;
  return { x: outer / 2 + size.stem * look.stripeAt - w / 2, w };
}

/**
 * Bakes (once) the pictures of drips of this glaze colour and size, in the real colours: the
 * outline is the glaze darkened like the baked glaze edge, the stripe the glaze lightened.
 */
export function dripTextures(scene: Phaser.Scene, color: number, size: DripSize): DripTextureSet {
  const set: DripTextureSet = {
    stem: keyOf('stem', size, color),
    bulb: keyOf('bulb', size, color),
    drop: keyOf('drop', size, color),
    spot: keyOf('spot', size, color),
  };
  const outline = shade(color, GLAZE_OUTLINE);
  const light = shade(color, look.stripeLift);
  const white = PALETTE.textLight;
  const o = size.outline;
  const stemOuter = size.stem + o * 2;
  const outer = bulbOuter(size);

  bakeTexture(scene, set.stem, stemOuter, STEM_SLICE, (g) => {
    g.fillStyle(outline, 1).fillRect(0, 0, stemOuter, STEM_SLICE);
    g.fillStyle(color, 1).fillRect(o, 0, size.stem, STEM_SLICE);
    const s = stripe(size, stemOuter);
    g.fillStyle(light, 1).fillRect(s.x, 0, s.w, STEM_SLICE);
  });

  bakeTexture(scene, set.bulb, outer, outer, (g) => {
    const c = outer / 2;
    const neckX = c - stemOuter / 2;
    g.fillStyle(outline, 1).fillCircle(c, c, c).fillRect(neckX, 0, stemOuter, c);
    g.fillStyle(color, 1)
      .fillCircle(c, c, size.bulb / 2)
      .fillRect(neckX + o, 0, size.stem, c);
    const s = stripe(size, outer);
    g.fillStyle(light, 1).fillRect(s.x, 0, s.w, c * 0.6);
    g.fillStyle(white, look.shineAlpha).fillEllipse(
      c + size.bulb * look.shineX,
      c + size.bulb * look.shineY,
      size.bulb * look.shineW,
      size.bulb * look.shineH,
    );
  });

  const drop = dropOuter(size);
  bakeTexture(scene, set.drop, drop.width, drop.height, (g) => {
    const r = drop.width / 2;
    const cy = drop.height - r;
    g.fillStyle(outline, 1).fillCircle(r, cy, r).fillTriangle(r, 0, 0, cy, drop.width, cy);
    const ri = r - o;
    g.fillStyle(color, 1)
      .fillCircle(r, cy, ri)
      .fillTriangle(r, o * 1.8, r - ri, cy, r + ri, cy);
    g.fillStyle(white, look.shineAlpha).fillEllipse(
      r + ri * look.shineX * 2,
      cy + ri * look.shineY * 2,
      ri * look.shineW * 2,
      ri * look.shineH * 2,
    );
  });

  const { spotWidth, spotHeight } = GLAZE_DRIPS.drop;
  const spotW = spotWidth + o * 2;
  const spotH = spotHeight + o * 2;
  const satR = spotHeight * SATELLITE.r * 2;
  bakeTexture(scene, set.spot, spotW + satR * 2, spotH, (g) => {
    const satX = spotW * SATELLITE.x + satR;
    const satY = spotH * SATELLITE.y + satR / 2;
    g.fillStyle(outline, 1)
      .fillEllipse(spotW / 2, spotH / 2, spotW, spotH)
      .fillCircle(satX, satY, satR);
    g.fillStyle(color, 1)
      .fillEllipse(spotW / 2, spotH / 2, spotWidth, spotHeight)
      .fillCircle(satX, satY, satR - o * 0.6);
    g.fillStyle(white, look.shineAlpha).fillEllipse(
      spotW / 2 + spotWidth * look.shineX,
      spotH / 2 + spotHeight * look.shineY,
      spotWidth * look.shineW,
      spotHeight * look.shineH,
    );
  });
  return set;
}
