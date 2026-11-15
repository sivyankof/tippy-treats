import type * as Phaser from 'phaser';
import { CHEST_LOOK } from '../../data/chest-look';
import { bakeTexture } from '../ui/bake-texture';
import {
  OUTLINE_SHARE,
  domeShape,
  drawFace,
  drawGlossMark,
  drawTwoToneBody,
  drawVerticalBand,
  fillPolygon,
  glossFromShares,
  outlineColor,
  drawOpeningRing,
  roundShape,
  topEdgeAt,
  type BandLook,
} from './plain-style';

const { size, colors, strap, lock } = CHEST_LOOK;

export const CHEST_TEXTURES = {
  body: 'chest_body',
  bodyOpen: 'chest_body_open',
  lid: 'chest_lid',
  lidInside: 'chest_lid_inside',
} as const;

const grow = size.bodyHeight * OUTLINE_SHARE;
const pad = Math.ceil(grow) + CHEST_LOOK.texturePad;
const lidW = size.width + size.lidOverhang * 2;
const insideH = size.lidHeight * CHEST_LOOK.insideLidShare;

/** Room above the body for the back half of the opening ring of the open chest. */
const openReach = Math.ceil(size.bodyHeight * CHEST_LOOK.opening.ry + grow);
const bodyTexW = size.width + pad * 2;
const bodyTexH = size.bodyHeight + pad * 2 + openReach;
const bodyCenterY = pad + openReach + size.bodyHeight / 2;
const lidTexW = lidW + pad * 2;
const lidTexH = size.lidHeight + pad * 2;
const insideTexH = insideH + pad * 2;

/** Where the body picture is anchored: the middle of the body. */
export const CHEST_BODY_ORIGIN = { x: 0.5, y: bodyCenterY / bodyTexH } as const;
/** Where the lid pictures hinge: the middle of their bottom edge. */
export const CHEST_LID_ORIGIN = { x: 0.5, y: (pad + size.lidHeight) / lidTexH } as const;
export const CHEST_INSIDE_ORIGIN = { x: 0.5, y: (pad + insideH) / insideTexH } as const;

const strapLook: BandLook = {
  base: colors.metal,
  shadow: colors.metalShadow,
  grow,
  shadowShare: CHEST_LOOK.strapShadowShare,
};

/** x of both straps, from the middle of a picture. */
function strapXs(cx: number): number[] {
  return [cx - size.width * strap.x, cx + size.width * strap.x];
}

function drawOpening(g: Phaser.GameObjects.Graphics, cx: number, top: number): void {
  const o = CHEST_LOOK.opening;
  const rx = (size.width / 2) * o.widthShare;
  const ry = size.bodyHeight * o.ry;
  drawOpeningRing(g, cx, top, rx, ry, o.innerShare, outlineColor(colors.wood), colors.inside, grow);
}

/** The gold lock plate with a dark keyhole, below the seam of the lid. */
function drawLock(g: Phaser.GameObjects.Graphics, cx: number, top: number): void {
  const cy = top + lock.drop;
  drawTwoToneBody(g, roundShape(lock.round), cx, cy, lock.width / 2, lock.height / 2, {
    base: colors.metal,
    shadow: colors.metalShadow,
    grow,
    band: CHEST_LOOK.bodyBand,
  });
  const dark = outlineColor(colors.metal);
  const holeY = cy - lock.keyholeRadius * lock.keyholeLift;
  g.fillStyle(dark, 1);
  g.fillCircle(cx, holeY, lock.keyholeRadius);
  fillPolygon(g, [
    { x: cx - lock.keyholeSlotWidth / 2, y: holeY },
    { x: cx + lock.keyholeSlotWidth / 2, y: holeY },
    { x: cx + lock.keyholeSlotWidth, y: holeY + lock.keyholeSlotHeight },
    { x: cx - lock.keyholeSlotWidth, y: holeY + lock.keyholeSlotHeight },
  ]);
}

function drawBody(g: Phaser.GameObjects.Graphics, open: boolean): void {
  const cx = bodyTexW / 2;
  const cy = bodyCenterY;
  const top = cy - size.bodyHeight / 2;
  drawTwoToneBody(
    g,
    roundShape(CHEST_LOOK.bodyRound),
    cx,
    cy,
    size.width / 2,
    size.bodyHeight / 2,
    {
      base: colors.wood,
      shadow: colors.woodShadow,
      grow,
      band: CHEST_LOOK.bodyBand,
    },
  );
  for (const x of strapXs(cx))
    drawVerticalBand(g, x, top, cy + size.bodyHeight / 2, strap.width, strapLook);
  if (open) drawOpening(g, cx, top);
  drawLock(g, cx, top);
  drawFace(g, size.bodyHeight, cx, cy, CHEST_LOOK.face, colors.face);
}

/** The domed lid seen from outside, hinged on the middle of its bottom edge. */
function drawLid(g: Phaser.GameObjects.Graphics): void {
  const cx = lidTexW / 2;
  const cy = pad + size.lidHeight / 2;
  const half = size.lidHeight / 2;
  const dome = domeShape(CHEST_LOOK.dome.top, CHEST_LOOK.dome.bottom);
  drawTwoToneBody(g, dome, cx, cy, lidW / 2, half, {
    base: colors.lid,
    shadow: colors.lidShadow,
    grow,
    band: CHEST_LOOK.lidBand,
  });
  // A dark lip along the bottom edge so the lid reads as a separate part sitting on the body.
  const lipInset = CHEST_LOOK.lip.inset;
  g.fillStyle(colors.lip, 1);
  g.fillRect(
    cx - lidW / 2 + lipInset,
    cy + half - CHEST_LOOK.lip.height,
    lidW - lipInset * 2,
    CHEST_LOOK.lip.height,
  );
  const silhouette = dome(cx, cy, lidW / 2 + grow, half + grow);
  for (const x of strapXs(cx)) {
    drawVerticalBand(g, x, (px) => topEdgeAt(silhouette, px), cy + half, strap.width, strapLook);
  }
  drawGlossMark(
    g,
    glossFromShares(CHEST_LOOK.gloss, cx, cy, size.lidHeight, colors.gloss, CHEST_LOOK.gloss.alpha),
  );
}

/** The lid thrown back: seen from inside, a plain panel with the ends of the straps. */
function drawLidInside(g: Phaser.GameObjects.Graphics): void {
  const cx = lidTexW / 2;
  const cy = pad + insideH / 2;
  drawTwoToneBody(g, roundShape(CHEST_LOOK.insideRound), cx, cy, lidW / 2, insideH / 2, {
    base: colors.lidInside,
    shadow: colors.lidInsideShadow,
    grow,
    band: CHEST_LOOK.lidBand,
  });
  for (const x of strapXs(cx))
    drawVerticalBand(g, x, cy - insideH / 2, cy + insideH / 2, strap.width, strapLook);
}

/** Bakes the chest: the body (closed and open), the lid seen from outside and from inside. Does nothing for pictures that exist. */
export function bakeChestTextures(scene: Phaser.Scene): void {
  bakeTexture(scene, CHEST_TEXTURES.body, bodyTexW, bodyTexH, (g) => drawBody(g, false));
  bakeTexture(scene, CHEST_TEXTURES.bodyOpen, bodyTexW, bodyTexH, (g) => drawBody(g, true));
  bakeTexture(scene, CHEST_TEXTURES.lid, lidTexW, lidTexH, drawLid);
  bakeTexture(scene, CHEST_TEXTURES.lidInside, lidTexW, insideTexH, drawLidInside);
}

/** Local y (body middle = 0) of the top of the body, and of the hinge of the open lid, the back edge of the opening. */
export const CHEST_TOP_Y = -size.bodyHeight / 2;
export const CHEST_HINGE_Y = CHEST_TOP_Y - size.bodyHeight * CHEST_LOOK.opening.ry;
/** Local y of the bottom edge of the closed lid. */
export const CHEST_LID_CLOSED_Y = CHEST_TOP_Y + size.lidOverlap;
