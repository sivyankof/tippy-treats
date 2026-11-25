import type * as Phaser from 'phaser';
import { TUTORIAL_ANIM } from '../../data/tutorial/tutorial-anim';
import { PALETTE } from '../../data/common/palette';
import { FIELD_PAD } from '../../data/common/picture-fields';
import { paddedOrigin } from '../../util/field-pad';
import {
  fillPolygon,
  OUTLINE_SHARE,
  outlineColor,
  roundRectPoints,
  type Pt,
} from '../fx/common/plain-style';
import { bakePadded, bakeTexture } from '../ui/common/bake-texture';
import { buildHand } from './hand-shape';

/** Both pictures of the tap hand sit on the shared atlas (the `fx_` prefix), so showing them adds no draw call. */
export const HINT_TEXTURES = {
  hand: 'fx_tap_hand',
  ray: 'fx_tap_ray',
  arrow: 'tutorial_arrow',
} as const;

const HAND_LOOK = TUTORIAL_ANIM.hand;
const HAND_SHAPE = buildHand(HAND_LOOK);
/** The hand without its outline: the size it is shown at (the picture is padded by the outline all round). */
export const HAND = { width: HAND_SHAPE.width, height: HAND_SHAPE.height };
/** Outline of the hand: the same share of its height as the layers have, logical pixels. */
const OUTLINE = HAND.height * OUTLINE_SHARE;
const HAND_FIELD = FIELD_PAD.tapHand;
/** Origin of the padded hand picture that sits the touch point (the top of the fingertip) on the image position. */
export const HAND_ORIGIN = paddedOrigin(
  [
    (HAND_SHAPE.tip.x + OUTLINE) / (HAND.width + OUTLINE * 2),
    (HAND_SHAPE.tip.y + OUTLINE) / (HAND.height + OUTLINE * 2),
  ],
  HAND.width + OUTLINE * 2,
  HAND.height + OUTLINE * 2,
  HAND_FIELD,
);

const RAYS = TUTORIAL_ANIM.rays;
const RAY_OUTLINE = RAYS.outline;
const RAY_FIELD = FIELD_PAD.tapRay;
/** Origin of the ray picture: the inner end of the ray, in the middle of its thickness. */
export const RAY_ORIGIN = paddedOrigin(
  [RAY_OUTLINE / (RAYS.length + RAY_OUTLINE * 2), 0.5],
  RAYS.length + RAY_OUTLINE * 2,
  RAYS.thick + RAY_OUTLINE * 2,
  RAY_FIELD,
);
const ARROW = TUTORIAL_ANIM.arrow;
const { width: ARROW_W, height: ARROW_H } = ARROW;
const ARROW_OUTLINE = ARROW_H * OUTLINE_SHARE;
/** Extra room around the arrow and its outline so the stroke fits the picture. */
const ARROW_FIELD = FIELD_PAD.hintArrow;
/** Height of the arrow with its outline, without the extra room: what the caption above it counts on. */
export const ARROW_SHOWN_HEIGHT = ARROW_H + ARROW_OUTLINE * 2;
/** Width of the arrow with its outline, without the extra room. */
const ARROW_SHOWN_WIDTH = ARROW_W + ARROW_OUTLINE * 2;
/** Origin y of the padded arrow picture that holds the spot of the arrow at `y` (0 top, 1 bottom, outline included). */
const arrowOriginY = (y: number): number =>
  paddedOrigin([0.5, y], ARROW_SHOWN_WIDTH, ARROW_SHOWN_HEIGHT, ARROW_FIELD)[1];
/** Origin y that puts the tip of the arrow (with its outline) where the bottom of the picture was before the extra room. */
export const ARROW_TIP_ORIGIN_Y = arrowOriginY(1);
/** Origin y of the flipped arrow: the tip with its outline sits on the position. */
export const ARROW_FLIPPED_ORIGIN_Y = arrowOriginY(0);

/** Fills `parts` with the current fill colour. */
function fillParts(g: Phaser.GameObjects.Graphics, parts: readonly (readonly Pt[])[]): void {
  for (const part of parts) fillPolygon(g, part);
}

/**
 * The glove in the manner of the layers: one outline pass under all the parts, the cream body
 * with a shadow band on the palm, the knuckle creases, a gloss streak on the finger and a pink cuff.
 */
function bakeHand(scene: Phaser.Scene): void {
  const shape = HAND_SHAPE;
  const body = PALETTE.panel;
  const line = outlineColor(HAND_LOOK.outlineBase);
  bakePadded(
    scene,
    HINT_TEXTURES.hand,
    HAND.width + OUTLINE * 2,
    HAND.height + OUTLINE * 2,
    HAND_FIELD,
    (g) => {
      g.translateCanvas(OUTLINE, OUTLINE);
      g.fillStyle(line, 1);
      fillParts(g, shape.silhouette(OUTLINE));
      // The palm: shadow tone first, the lit copy over it leaves a band at the bottom and right.
      g.fillStyle(PALETTE.panelShadow, 1);
      fillPolygon(g, shape.palm);
      g.fillStyle(body, 1);
      fillPolygon(g, shape.palmLit);
      fillParts(g, [shape.thumb, shape.finger, ...shape.knuckles]);
      // The cuff: its own outline lies over the palm, then shadow and lit tones.
      g.fillStyle(outlineColor(HAND_LOOK.cuffShadow), 1);
      fillPolygon(g, shape.cuffGrown(HAND_LOOK.cuffRim));
      g.fillStyle(HAND_LOOK.cuffShadow, 1);
      fillPolygon(g, shape.cuff);
      g.fillStyle(HAND_LOOK.cuffColor, 1);
      fillPolygon(g, shape.cuffLit);
      g.lineStyle(HAND_LOOK.creaseWidth * HAND_LOOK.scale, line, HAND_LOOK.creaseAlpha);
      for (const crease of shape.creases) {
        g.beginPath();
        crease.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
        g.strokePath();
      }
      g.fillStyle(PALETTE.textLight, HAND_LOOK.glossAlpha);
      fillPolygon(g, shape.fingerGloss.streak);
      g.fillCircle(shape.fingerGloss.dot.x, shape.fingerGloss.dot.y, shape.fingerGloss.dotRadius);
      g.fillStyle(PALETTE.textLight, HAND_LOOK.cuffGlossAlpha);
      fillPolygon(g, shape.cuffGloss);
    },
  );
}

/** A short gold stroke with the warm outline, pointing right from its inner end: one ray of the press. */
function bakeRay(scene: Phaser.Scene): void {
  const { length, thick } = RAYS;
  bakePadded(
    scene,
    HINT_TEXTURES.ray,
    length + RAY_OUTLINE * 2,
    thick + RAY_OUTLINE * 2,
    RAY_FIELD,
    (g) => {
      const half = thick / 2;
      g.translateCanvas(RAY_OUTLINE, RAY_OUTLINE);
      g.fillStyle(outlineColor(PALETTE.gold), 1);
      fillPolygon(
        g,
        roundRectPoints(
          length / 2,
          half,
          length / 2 + RAY_OUTLINE,
          half + RAY_OUTLINE,
          half + RAY_OUTLINE,
        ),
      );
      g.fillStyle(PALETTE.gold, 1);
      fillPolygon(g, roundRectPoints(length / 2, half, length / 2, half, half));
    },
  );
}

/** A fat arrow that points down, drawn as stem and head: outline first, then the fill. */
function bakeArrow(scene: Phaser.Scene): void {
  const pad = ARROW_OUTLINE + ARROW_FIELD;
  bakeTexture(scene, HINT_TEXTURES.arrow, ARROW_W + pad * 2, ARROW_H + pad * 2, (g) => {
    const stemX = pad + ARROW_W * ARROW.stemX;
    const stemW = ARROW_W * ARROW.stemWidth;
    const headY = pad + ARROW_H * ARROW.headY;
    const stemH = headY - pad + ARROW.stemOverlap;
    const tip = pad + ARROW_H;
    const shapes = (): void => {
      g.fillRoundedRect(stemX, pad, stemW, stemH, ARROW.stemRadius);
      g.fillTriangle(pad, headY, pad + ARROW_W, headY, pad + ARROW_W / 2, tip);
    };
    const line = outlineColor(PALETTE.gold);
    g.lineStyle(ARROW_OUTLINE * 2, line, 1);
    g.fillStyle(line, 1);
    shapes();
    g.strokeRoundedRect(stemX, pad, stemW, stemH, ARROW.stemRadius);
    g.strokeTriangle(pad, headY, pad + ARROW_W, headY, pad + ARROW_W / 2, tip);
    g.fillStyle(PALETTE.gold, 1);
    shapes();
  });
}

/** Bakes the pictures of the hints once. */
export function bakeHintTextures(scene: Phaser.Scene): void {
  bakeHand(scene);
  bakeRay(scene);
  bakeArrow(scene);
}
