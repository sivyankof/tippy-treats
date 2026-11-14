import type * as Phaser from 'phaser';
import { TUTORIAL_ANIM } from '../../data/tutorial-anim';
import { PALETTE } from '../../data/palette';
import { bakeTexture } from '../ui/bake-texture';

export const HINT_TEXTURES = { hand: 'tutorial_hand', arrow: 'tutorial_arrow' } as const;

/** Outline of the hand and the arrow, logical pixels. */
const OUTLINE = 7;
const HAND = { width: 150, height: 200 };
const { width: ARROW_W, height: ARROW_H } = TUTORIAL_ANIM.arrow;

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
  bakeTexture(scene, HINT_TEXTURES.hand, HAND.width, HAND.height, (g) => {
    const fill = (color: number, grow: number): void => {
      g.fillStyle(color, 1);
      for (const b of HAND_SHAPES) {
        g.fillRoundedRect(b.x - grow, b.y - grow, b.w + grow * 2, b.h + grow * 2, b.r + grow);
      }
    };
    fill(PALETTE.textDark, OUTLINE);
    fill(PALETTE.panel, 0);
  });
}

/** A fat arrow that points down, drawn as stem and head: outline first, then the fill. */
function bakeArrow(scene: Phaser.Scene): void {
  const pad = OUTLINE;
  bakeTexture(scene, HINT_TEXTURES.arrow, ARROW_W + pad * 2, ARROW_H + pad * 2, (g) => {
    const stemX = pad + ARROW_W * 0.3;
    const stemW = ARROW_W * 0.4;
    const headY = pad + ARROW_H * 0.45;
    const tip = pad + ARROW_H;
    const shapes = (): void => {
      g.fillRoundedRect(stemX, pad, stemW, headY - pad + 10, 14);
      g.fillTriangle(pad, headY, pad + ARROW_W, headY, pad + ARROW_W / 2, tip);
    };
    g.lineStyle(OUTLINE * 2, PALETTE.textDark, 1);
    g.fillStyle(PALETTE.textDark, 1);
    shapes();
    g.strokeRoundedRect(stemX, pad, stemW, headY - pad + 10, 14);
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
