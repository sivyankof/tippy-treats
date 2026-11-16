import type * as Phaser from 'phaser';
import { MASTERY_FRAME } from '../../data/mastery-look';
import { parseHex } from '../../util/color';
import { fillOutlinedPolygon } from '../fx/plain-style';
import { starPoints } from '../objects/creature-art/rainbow-geometry';
import { bakeTexture } from './bake-texture';

/**
 * Texture key of the gold mastery frame (docs/06, "Золотая рамка"): a ring the shape and size of
 * the rarity rim of a collection card, with four stars on the corners, drawn over the card of a
 * level-5 creature. Its centre is transparent; bake it with `bakeMasteryFrame` first.
 */
export const MASTERY_FRAME_KEY = MASTERY_FRAME.key;

/** Size of the picture: the card plus the room around it for the corner stars. */
export function masteryFrameSize(): { width: number; height: number } {
  const { width, height, pad } = MASTERY_FRAME;
  return { width: width + pad * 2, height: height + pad * 2 };
}

const STAR_NOTCH = 0.3;
const STAR_POINTS = 4;
const GLINT_RADIUS_SHARE = 0.22;

/** Bakes the gold frame once (the key is kept when it exists). Put it at the card centre. */
export function bakeMasteryFrame(scene: Phaser.Scene): void {
  const size = masteryFrameSize();
  bakeTexture(scene, MASTERY_FRAME_KEY, size.width, size.height, (g) => {
    const f = MASTERY_FRAME;
    const gold = parseHex(f.gold);
    const light = parseHex(f.goldLight);
    const dark = parseHex(f.goldDark);
    const ring = f.outline + f.band;
    const x = f.pad;
    const y = f.pad;
    const stroke = (inset: number, width: number, color: number, alpha = 1): void => {
      g.lineStyle(width, color, alpha);
      g.strokeRoundedRect(
        x + inset,
        y + inset,
        f.width - inset * 2,
        f.height - inset * 2,
        Math.max(0, f.radius - inset),
      );
    };
    stroke(ring / 2, ring, dark);
    stroke(f.outline + f.band / 2, f.band, gold);
    stroke(f.outline + f.band * 0.2, f.band * 0.28, light, 0.9);
    stroke(f.outline + f.band, 2, dark, 0.55);
    // A shine along the top of the band, kept off the corners.
    g.lineStyle(f.shine.height, parseHex(f.goldLight), f.shine.alpha);
    g.beginPath();
    g.moveTo(x + f.shine.inset, y + f.outline + f.band * 0.5);
    g.lineTo(x + f.width - f.shine.inset, y + f.outline + f.band * 0.5);
    g.strokePath();
    // Stars on the corners, on the middle of the band.
    const arc = f.radius - ring / 2;
    const lean = arc * (1 - Math.SQRT1_2);
    const corners: ReadonlyArray<readonly [number, number]> = [
      [x + lean, y + lean],
      [x + f.width - lean, y + lean],
      [x + lean, y + f.height - lean],
      [x + f.width - lean, y + f.height - lean],
    ];
    for (const [cx, cy] of corners) {
      fillOutlinedPolygon(
        g,
        starPoints(cx, cy, f.star.r, STAR_NOTCH, STAR_POINTS),
        light,
        dark,
        2.5,
      );
      g.fillStyle(parseHex(f.star.white), 1);
      g.fillCircle(cx, cy, f.star.r * GLINT_RADIUS_SHARE);
    }
  });
}
