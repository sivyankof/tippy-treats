import type * as Phaser from 'phaser';
import { OVEN_LOOK } from '../../data/oven-look';
import { DEG_TO_RAD } from '../../util/math';
import { bakeTexture } from '../ui/bake-texture';
import {
  OUTLINE_SHARE,
  drawFace,
  drawGlossMark,
  drawTwoToneBody,
  fillPolygon,
  glossFromShares,
  outlineColor,
  roundShape,
  ellipsePoints,
} from './plain-style';

const { size, colors, window: win } = OVEN_LOOK;

export type OvenState = 'lit' | 'spent';

export const OVEN_TEXTURES = {
  litFace: 'oven_lit_face',
  litPlain: 'oven_lit_plain',
  spentFace: 'oven_spent_face',
  spentPlain: 'oven_spent_plain',
  ringLit: 'oven_ring_lit',
  ringSpent: 'oven_ring_spent',
} as const;

const grow = size.height * OUTLINE_SHARE;
const pad = Math.ceil(grow) + OVEN_LOOK.texturePad;
const texW = size.width + pad * 2;
const texH = size.height + pad * 2;
const cx = texW / 2;
const cy = texH / 2;
const windowCenterY = cy + size.height * win.y;
const windowRadius = size.height * win.radius;
const ringWidth = size.height * win.ring;

/** The picture is anchored on the middle of the body. */
export const OVEN_ORIGIN = { x: 0.5, y: 0.5 } as const;
/** Where the window sits from the middle of the body, pixels, and its radius. */
export const OVEN_WINDOW = { y: size.height * win.y, radius: windowRadius } as const;
export const OVEN_PICTURE_HEIGHT = size.height;
/** Face parts' centre from the middle of the body (the eyes line), for closed eyes drawn by the caller. */
export const OVEN_FACE_EYES_Y = size.height * OVEN_LOOK.face.eyeY;

function drawBody(g: Phaser.GameObjects.Graphics, state: OvenState, face: boolean): void {
  const c = colors[state];
  drawTwoToneBody(g, roundShape(OVEN_LOOK.round), cx, cy, size.width / 2, size.height / 2, {
    base: c.base,
    shadow: c.shadow,
    grow,
    band: OVEN_LOOK.band,
  });
  // The dark inside of the window, with the outline of the body tone around it.
  g.fillStyle(outlineColor(c.base), 1);
  g.fillCircle(cx, windowCenterY, windowRadius + grow / 2);
  g.fillStyle(c.inside, 1);
  g.fillCircle(cx, windowCenterY, windowRadius - ringWidth / 2);
  drawGlossMark(
    g,
    glossFromShares(OVEN_LOOK.gloss, cx, cy, size.height, colors.gloss, OVEN_LOOK.gloss.alpha, {
      x: size.width,
      y: size.height,
    }),
  );
  if (!face) return;
  if (state === 'lit') {
    drawFace(g, size.height, cx, cy, OVEN_LOOK.face, colors.face);
    return;
  }
  // Sleeping: closed eyes (arcs bowing down) and a small calm smile.
  const f = OVEN_LOOK.face;
  const e = OVEN_LOOK.sleepEye;
  g.lineStyle(size.height * e.thick, colors.face, 1);
  for (const side of [-1, 1]) {
    const ex = cx + (side * size.height * f.eyeSpacing) / 2;
    const ey = cy + size.height * f.eyeY;
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      const px = ex - Math.cos(a) * size.height * e.halfWidth;
      const py = ey + Math.sin(a) * size.height * e.depth;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
  }
  const smile = { ...f, eyeRadius: 0, smileSpanDeg: f.smileSpanDeg * 0.7 };
  drawFace(g, size.height, cx, cy, smile, colors.face);
}

/** The frame of the window: a metal ring with a gloss, the middle stays see-through (the flame lives behind it). */
function drawRing(g: Phaser.GameObjects.Graphics, state: OvenState): void {
  const c = colors[state];
  g.lineStyle(ringWidth + grow, outlineColor(c.ring), 1);
  g.strokeCircle(cx, windowCenterY, windowRadius);
  g.lineStyle(ringWidth, c.ringShadow, 1);
  g.strokeCircle(cx, windowCenterY, windowRadius);
  // The lit part of the ring: a smaller arc pushed to the top left, like the band of the bodies.
  g.lineStyle(ringWidth * 0.7, c.ring, 1);
  g.beginPath();
  g.arc(cx, windowCenterY, windowRadius - ringWidth * 0.1, 100 * DEG_TO_RAD, 300 * DEG_TO_RAD);
  g.strokePath();
  g.fillStyle(colors.gloss, 0.9);
  fillPolygon(
    g,
    ellipsePoints(
      cx - windowRadius * 0.62,
      windowCenterY - windowRadius * 0.62,
      windowRadius * 0.2,
      ringWidth * 0.2,
      -45 * DEG_TO_RAD,
    ),
  );
}

/** Bakes every oven picture once. */
export function bakeOvenTextures(scene: Phaser.Scene): void {
  const states: Array<[string, OvenState, boolean]> = [
    [OVEN_TEXTURES.litFace, 'lit', true],
    [OVEN_TEXTURES.litPlain, 'lit', false],
    [OVEN_TEXTURES.spentFace, 'spent', true],
    [OVEN_TEXTURES.spentPlain, 'spent', false],
  ];
  for (const [key, state, face] of states)
    bakeTexture(scene, key, texW, texH, (g) => drawBody(g, state, face));
  bakeTexture(scene, OVEN_TEXTURES.ringLit, texW, texH, (g) => drawRing(g, 'lit'));
  bakeTexture(scene, OVEN_TEXTURES.ringSpent, texW, texH, (g) => drawRing(g, 'spent'));
}
