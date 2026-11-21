import type * as Phaser from 'phaser';
import { BACKDROP_COLORS } from '../../src/data/backdrop/backdrop-colors';
import { STORE_CREATIVE } from '../../src/data/debug/store-shots';
import { bakePadded } from '../../src/game/ui/common/bake-texture';
import {
  OUTLINE_SHARE,
  drawGlossMark,
  fillOutlinedPolygon,
  fillPolygon,
  outlineColor,
  roundRectPoints,
} from '../../src/game/fx/common/plain-style';
import { shade } from '../../src/util/color';

/**
 * A glass jar of sweets for the shelves of the App Store pictures, in the manner of the plain
 * layers (docs/06, «Манера картинок»): a warm outline in the dark tone of each part, flat fills in
 * two tones (the main tone a smaller copy moved up and left over the shadow tone), a gloss stroke
 * with a dot. Drawn with the game's own helpers of that manner; only the store pictures use it.
 */

const J = STORE_CREATIVE.jars;
const PAD = J.pad;
/** The lid's height and how far it reaches in from the sides, shares of the jar. */
const LID = { height: 0.17, inset: 0.1 };
/** The shadow tone of a part, and how far its main tone moves up and left over it (a share of the outline). */
const SHADE = -0.16;
const LIFT = 0.9;
/** Sweets inside: rows and columns, their radius (a share of the jar width). */
const SWEETS = { rows: 3, columns: 3, radius: 0.13 };

export const jarKey = (i: number): string => `store_jar_${String(i)}`;

/** One part: the outline, the shadow tone, the main tone moved up and left. */
function part(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  radius: number,
  fill: number,
  outline: number,
): void {
  fillOutlinedPolygon(
    g,
    roundRectPoints(cx, cy, rx, ry, radius),
    shade(fill, SHADE),
    outlineColor(fill),
    outline,
  );
  const lift = outline * LIFT;
  g.fillStyle(fill, 1);
  fillPolygon(
    g,
    roundRectPoints(cx - lift / 2, cy - lift / 2, rx - lift / 2, ry - lift / 2, radius),
  );
}

/** Bakes jar `i` (its lid colour from `STORE_CREATIVE.jars.lids`); the picture is `jarSize()`. */
export function bakeJar(scene: Phaser.Scene, i: number): void {
  const w = J.width;
  const h = J.height;
  const outline = OUTLINE_SHARE * h;
  const lid = J.lids[i % J.lids.length] ?? J.lids[0];
  const sweets = BACKDROP_COLORS.showcase.treat;
  bakePadded(scene, jarKey(i), w, h, PAD, (g) => {
    const lidH = LID.height * h;
    const bodyTop = lidH * 0.8;
    // The glass body, then the sweets in it, then the lid over its neck.
    part(g, w / 2, (bodyTop + h) / 2, w / 2, (h - bodyTop) / 2, w * 0.22, J.glass, outline);
    const r = SWEETS.radius * w;
    for (let row = 0; row < SWEETS.rows; row++) {
      for (let col = 0; col < SWEETS.columns; col++) {
        const x = w / 2 + (col - (SWEETS.columns - 1) / 2) * r * 2.1 + (row % 2) * r * 0.5;
        const y = h - outline * 2 - r - row * r * 1.8;
        const color = sweets[(row * SWEETS.columns + col + i) % sweets.length] ?? J.glass;
        g.fillStyle(outlineColor(color), 1).fillCircle(x, y, r);
        g.fillStyle(shade(color, SHADE), 1).fillCircle(x, y, r - outline * 0.6);
        g.fillStyle(color, 1).fillCircle(x - outline * 0.35, y - outline * 0.35, r - outline);
      }
    }
    drawGlossMark(g, {
      x: w * 0.24,
      y: bodyTop + (h - bodyTop) * 0.32,
      length: (h - bodyTop) * 0.3,
      thick: outline * 1.1,
      tilt: Math.PI / 2,
      dotGap: outline * 1.2,
      dotRadius: outline * 0.55,
      color: 0xffffff,
      alpha: 0.85,
    });
    const lidCy = lidH / 2 + outline / 2;
    const lidRx = w / 2 - LID.inset * w;
    part(g, w / 2, lidCy, lidRx, lidH / 2, lidH * 0.4, lid, outline);
    drawGlossMark(g, {
      x: w / 2 - lidRx * 0.45,
      y: lidCy - lidH * 0.12,
      length: lidRx * 0.5,
      thick: outline * 0.9,
      tilt: 0,
      dotGap: outline,
      dotRadius: outline * 0.45,
      color: 0xffffff,
      alpha: 0.85,
    });
  });
}
