import type * as Phaser from 'phaser';
import { TUTORIAL_ANIM } from '../../data/tutorial/tutorial-anim';
import { PALETTE } from '../../data/common/palette';
import { FIELD_PAD } from '../../data/common/picture-fields';
import { paddedOrigin } from '../../util/field-pad';
import { OUTLINE_SHARE, outlineColor } from '../fx/plain-style';
import { bakeTexture } from '../ui/bake-texture';

export const HINT_TEXTURES = { hand: 'tutorial_hand', arrow: 'tutorial_arrow' } as const;

/** The hand without its outline: the size it is shown at (the picture is padded by the outline all round). */
export const HAND = { width: 150, height: 200 };
/** Outline of the hand: the same share of its height as the layers have, logical pixels. */
const OUTLINE = HAND.height * OUTLINE_SHARE;
/** Share of the padded hand picture's height above the hand itself, for an origin that ignores the padding. */
export const HAND_TOP_ORIGIN = OUTLINE / (HAND.height + OUTLINE * 2);
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

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

/** The fingers and the palm of a hand that points up, in a 150 x 200 picture. */
const HAND_SHAPES: readonly Box[] = [
  { x: 52, y: 8, w: 40, h: 110, r: 20 },
  { x: 24, y: 86, w: 100, h: 106, r: 40 },
  { x: 8, y: 108, w: 44, h: 58, r: 22 },
];

function bakeHand(scene: Phaser.Scene): void {
  bakeTexture(
    scene,
    HINT_TEXTURES.hand,
    HAND.width + OUTLINE * 2,
    HAND.height + OUTLINE * 2,
    (g) => {
      const fill = (color: number, grow: number): void => {
        g.fillStyle(color, 1);
        for (const b of HAND_SHAPES) {
          g.fillRoundedRect(
            OUTLINE + b.x - grow,
            OUTLINE + b.y - grow,
            b.w + grow * 2,
            b.h + grow * 2,
            b.r + grow,
          );
        }
      };
      fill(outlineColor(PALETTE.panel), OUTLINE);
      fill(PALETTE.panel, 0);
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
  bakeArrow(scene);
}
