import type * as Phaser from 'phaser';
import { GIFT_LOOK } from '../../data/gift-look';
import { MENU } from '../../data/menu-layout';
import { DEG_TO_RAD } from '../../util/math';
import { bakeTexture } from '../ui/bake-texture';
import {
  OUTLINE_SHARE,
  drawFace,
  drawGlossMark,
  glossFromShares,
  drawTwoToneBody,
  ellipsePoints,
  fillPolygon,
  outlineColor,
  roundRectPoints,
  type BodyShape,
} from './plain-style';

const { colors, bow } = GIFT_LOOK;
const box = MENU.newCreature;

export const GIFT_TEXTURES = {
  body: 'gift_body',
  bodyFace: 'gift_body_face',
  bodyOpen: 'gift_body_open',
  bodyFaceOpen: 'gift_body_face_open',
  lid: 'gift_lid',
} as const;

/** Sizes of the box pictures, in texture pixels. */
const bodyH = box.boxSize - box.lidHeight;
const lidW = box.boxSize + box.lidOverhang * 2;
const grow = bodyH * OUTLINE_SHARE;
const pad = Math.ceil(grow) + GIFT_LOOK.texturePad;
/** How far the bow reaches above the top of the lid. */
const bowReach = Math.ceil(box.bowSize * (bow.loopRise + bow.loopRx) + grow);

const bodyTexW = box.boxSize + pad * 2;
const bodyTexH = bodyH + pad * 2;
const lidTexW = lidW + pad * 2;
const lidTexH = bowReach + box.lidHeight + pad * 2;
/** The centre of the lid's own rectangle inside its picture: the lid pivots around it. */
const lidCenterY = pad + bowReach + box.lidHeight / 2;

/** Where the lid picture pivots (origin of the image). */
export const GIFT_LID_ORIGIN = { x: 0.5, y: lidCenterY / lidTexH } as const;

const roundShape =
  (share: number): BodyShape =>
  (cx, cy, rx, ry) =>
    roundRectPoints(cx, cy, rx, ry, Math.min(rx, ry) * share);

const ellipseShape =
  (rad: number): BodyShape =>
  (cx, cy, rx, ry) =>
    ellipsePoints(cx, cy, rx, ry, rad);

/** The vertical ribbon band from `top` to `bottom`: an outline on both sides and a shadow strip. */
function drawRibbon(g: Phaser.GameObjects.Graphics, cx: number, top: number, bottom: number): void {
  const w = box.ribbonWidth;
  g.fillStyle(outlineColor(colors.ribbon), 1);
  g.fillRect(cx - w / 2 - grow, top, w + grow * 2, bottom - top);
  g.fillStyle(colors.ribbonShadow, 1);
  g.fillRect(cx - w / 2, top, w, bottom - top);
  g.fillStyle(colors.ribbon, 1);
  g.fillRect(cx - w / 2, top, w * (1 - GIFT_LOOK.ribbonBand), bottom - top);
}

function drawBody(g: Phaser.GameObjects.Graphics, withFace: boolean, open: boolean): void {
  const cx = bodyTexW / 2;
  const cy = bodyTexH / 2;
  drawTwoToneBody(g, roundShape(GIFT_LOOK.bodyRound), cx, cy, box.boxSize / 2, bodyH / 2, {
    base: colors.box,
    shadow: colors.boxShadow,
    grow,
    band: GIFT_LOOK.bodyBand,
  });
  drawRibbon(g, cx, cy - bodyH / 2, cy + bodyH / 2);
  drawGlossMark(
    g,
    glossFromShares(GIFT_LOOK.gloss.body, cx, cy, bodyH, colors.gloss, GIFT_LOOK.gloss.alpha),
  );
  if (open) drawOpening(g, cx, cy - bodyH / 2);
  if (withFace) drawFace(g, bodyH, cx, cy, GIFT_LOOK.face, colors.face);
}

/** The mouth of the opened box: a ring in the body's outline tone with a dark inside; the ribbon stops at it. */
function drawOpening(g: Phaser.GameObjects.Graphics, cx: number, top: number): void {
  const o = GIFT_LOOK.opening;
  const rx = (box.boxSize / 2) * o.widthShare;
  const ry = bodyH * o.ry;
  const cy = top + bodyH * o.drop + ry;
  g.fillStyle(outlineColor(colors.box), 1);
  fillPolygon(g, ellipsePoints(cx, cy, rx + grow, ry + grow, 0));
  g.fillStyle(colors.inside, 1);
  fillPolygon(
    g,
    ellipsePoints(cx, cy + ry * (1 - o.innerShare), rx * o.innerShare, ry * o.innerShare, 0),
  );
}

function drawBowLoop(g: Phaser.GameObjects.Graphics, x: number, y: number, rad: number): void {
  const rx = box.bowSize * bow.loopRx;
  const ry = box.bowSize * bow.loopRy;
  drawTwoToneBody(g, ellipseShape(rad), x, y, rx, ry, {
    base: colors.ribbon,
    shadow: colors.ribbonShadow,
    grow,
    band: bow.band,
  });
  // The dark hollow of the loop, pushed towards the knot.
  g.fillStyle(outlineColor(colors.ribbon), 1);
  fillPolygon(
    g,
    ellipsePoints(
      x - Math.sign(x - lidTexW / 2) * rx * bow.hollowShift,
      y + ry * bow.hollowShift,
      rx * bow.hollow,
      ry * bow.hollow,
      rad,
    ),
  );
}

function drawLid(g: Phaser.GameObjects.Graphics): void {
  const cx = lidTexW / 2;
  const cy = lidCenterY;
  const lidTop = cy - box.lidHeight / 2;
  drawTwoToneBody(g, roundShape(GIFT_LOOK.lidRound), cx, cy, lidW / 2, box.lidHeight / 2, {
    base: colors.lid,
    shadow: colors.lidShadow,
    grow,
    band: GIFT_LOOK.lidBand,
  });
  drawRibbon(g, cx, lidTop, cy + box.lidHeight / 2);
  drawGlossMark(
    g,
    glossFromShares(GIFT_LOOK.gloss.lid, cx, cy, bodyH, colors.gloss, GIFT_LOOK.gloss.alpha),
  );
  const loopY = lidTop - box.bowSize * bow.loopRise;
  const tilt = bow.tiltDeg * DEG_TO_RAD;
  drawBowLoop(g, cx - box.bowSize * bow.loopX, loopY, tilt);
  drawBowLoop(g, cx + box.bowSize * bow.loopX, loopY, -tilt);
  drawTwoToneBody(
    g,
    ellipseShape(0),
    cx,
    lidTop - box.bowSize * bow.knotRise,
    box.bowSize * bow.knotRx,
    box.bowSize * bow.knotRy,
    { base: colors.ribbon, shadow: colors.ribbonShadow, grow, band: bow.band },
  );
}

/** Bakes the box: the body (with or without the face, closed and opened) and the lid. Does nothing for pictures that exist. */
export function bakeGiftTextures(scene: Phaser.Scene, withFace: boolean): void {
  bakeTexture(scene, bodyKey(withFace, false), bodyTexW, bodyTexH, (g) =>
    drawBody(g, withFace, false),
  );
  bakeTexture(scene, bodyKey(withFace, true), bodyTexW, bodyTexH, (g) =>
    drawBody(g, withFace, true),
  );
  bakeTexture(scene, GIFT_TEXTURES.lid, lidTexW, lidTexH, drawLid);
}

/** Texture key of the body picture. */
export function bodyKey(withFace: boolean, open: boolean): string {
  if (withFace) return open ? GIFT_TEXTURES.bodyFaceOpen : GIFT_TEXTURES.bodyFace;
  return open ? GIFT_TEXTURES.bodyOpen : GIFT_TEXTURES.body;
}
