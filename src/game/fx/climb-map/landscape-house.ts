import { BACKDROP_COLORS } from '../../../data/backdrop/backdrop-colors';
import { CLIMB_LANDSCAPE } from '../../../data/progression/climb-landscape';
import { shade } from '../../../util/color';
import { fillPolygon, outlineColor, roundRectPoints, type Pt } from '../common/plain-style';
import {
  box,
  disc,
  drawBody,
  drawGroup,
  drawPoly,
  gloss,
  ovalPart,
  type LandCtx,
} from './landscape-kit';
import { skyColorAt } from './landscape-math';

const L = CLIMB_LANDSCAPE;
const H = L.house;
const C = BACKDROP_COLORS;

/** A flat rectangle with no outline. */
function flat(
  ctx: LandCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha = 1,
): void {
  ctx.g.fillStyle(ctx.c(color), alpha);
  ctx.g.fillRect(x, y, w, h);
}

/** The side walls of the house for the whole height of the picture: two posts with a warm outline. */
function drawPosts(ctx: LandCtx, top = 0, bottom = ctx.height): void {
  const x0 = H.inset;
  const x1 = ctx.width - H.inset;
  for (const [x, side] of [
    [x0 - 8, 1],
    [x1 - 14, -1],
  ] as const) {
    flat(ctx, x - 5, top, 32, bottom - top, outlineColor(H.frame));
    flat(ctx, x, top, 22, bottom - top, shade(H.frame, -0.2));
    flat(ctx, x + (side === 1 ? 0 : 6), top, 16, bottom - top, H.frame);
  }
}

/** The beam that closes a floor: it runs the width of the house, a little wider than the walls. */
function drawSlab(ctx: LandCtx, y: number): void {
  const x = H.inset - 16;
  const w = ctx.width - (H.inset - 16) * 2;
  drawBody(ctx, box(x, y, w, H.slab, 0.3), H.beam, 3.5);
  flat(ctx, x + 14, y + 5, w - 28, 3, 0xffffff, 0.25);
}

/** The wall of a floor between the posts. */
function drawWall(ctx: LandCtx, color: number): void {
  flat(ctx, H.inset + 8, 0, ctx.width - (H.inset + 8) * 2, ctx.height, color);
}

/** The grass and earth the house stands on, with the sky margins beside it: a low strip, so the tower stands on the line of the floor. */
function drawGround(ctx: LandCtx): void {
  const y = ctx.height - H.ground;
  flat(ctx, 0, y - 3, ctx.width, 3, 0x8a5a3c);
  flat(ctx, 0, y, ctx.width, H.ground, 0xc9a07a);
  flat(ctx, 0, y, ctx.width, 5, 0x8fcf7a);
}

/** A jar, a pot or a mug: a body with a lid band and a gloss. */
function drawJar(
  ctx: LandCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  lid: number,
): void {
  drawBody(ctx, box(x, y, w, h, 0.3), fill, 3.5);
  drawBody(ctx, box(x + w * 0.12, y - 8, w * 0.76, 12, 0.4), lid, 3);
  gloss(ctx, x + w * 0.32, y + h * 0.3, w * 0.34, 0.7);
}

/** A cake on a stand: two sponge layers with glaze, a cherry. */
function drawCake(ctx: LandCtx, cx: number, y: number, scale: number, glaze: number): void {
  const s = scale;
  drawBody(ctx, box(cx - 30 * s, y - 6 * s, 60 * s, 8 * s, 0.5), 0xe9d5c3, 3);
  drawBody(ctx, box(cx - 8 * s, y - 20 * s, 16 * s, 16 * s, 0.2), 0xe9d5c3, 3);
  drawBody(ctx, box(cx - 28 * s, y - 52 * s, 56 * s, 34 * s, 0.35), C.showcase.cake, 3.5);
  drawBody(ctx, box(cx - 28 * s, y - 52 * s, 56 * s, 16 * s, 0.45), glaze, 3);
  drawBody(ctx, disc(cx, y - 60 * s, 6 * s), C.showcase.cherry, 2.5);
}

/** The kitchen: the ground floor of the house, a cut through the room. */
export function drawKitchen(ctx: LandCtx): void {
  const { width, height } = ctx;
  const floor = height - H.ground;
  const left = H.inset + 24;
  const right = width - H.inset - 24;
  drawWall(ctx, H.wall);
  // The tiles behind the counter.
  const tileTop = floor - 250;
  flat(ctx, H.inset + 8, tileTop, width - (H.inset + 8) * 2, floor - tileTop, L.kitchen.tiles);
  for (let x = left + 18; x < right; x += 56)
    flat(ctx, x, tileTop, 3, floor - tileTop, shade(L.kitchen.tiles, -0.08));
  for (let y = tileTop + 50; y < floor; y += 50)
    flat(ctx, left - 16, y, right - left + 32, 3, shade(L.kitchen.tiles, -0.08));
  flat(ctx, H.inset + 8, tileTop - 6, width - (H.inset + 8) * 2, 6, shade(L.kitchen.tiles, -0.28));
  // The rail with hanging ladles and a pot.
  drawBody(ctx, box(left, 50, 250, 10, 0.5), C.kitchen.rail, 3);
  for (const [x, len] of [
    [left + 40, 56],
    [left + 100, 70],
    [left + 200, 50],
  ] as const) {
    drawBody(ctx, box(x - 3, 58, 6, len, 0.5), C.kitchen.ladle, 2.5);
    drawBody(ctx, disc(x, 58 + len + 4, 15), C.kitchen.ladle, 3);
  }
  // The window on the right with a curtain.
  const wx = right - 150;
  drawBody(ctx, box(wx, 70, 140, 120, 0.12), 0xffffff, 4.5);
  ctx.g.fillStyle(ctx.c(skyColorAt(0.8)), 1);
  fillPolygon(ctx.g, roundRectPoints(wx + 70, 130, 56, 46, 8));
  flat(ctx, wx + 67, 84, 6, 92, 0xffffff);
  flat(ctx, wx + 14, 127, 112, 6, 0xffffff);
  drawBody(ctx, box(wx - 6, 62, 40, 70, 0.35), 0xffa0b8, 3);
  drawBody(ctx, box(wx + 106, 62, 40, 70, 0.35), 0xffa0b8, 3);
  // The counter: cupboards under a light top.
  const cTop = floor - 118;
  drawBody(ctx, box(left - 16, cTop + 18, right - left + 32, 100, 0.12), L.kitchen.counter, 4);
  for (let x = left - 4; x < right - 40; x += 112) {
    drawBody(ctx, box(x + 6, cTop + 30, 92, 76, 0.18), shade(L.kitchen.counter, 0.12), 3);
    drawBody(ctx, disc(x + 80, cTop + 68, 5), 0xffe27a, 2);
  }
  drawBody(ctx, box(left - 28, cTop, right - left + 56, 22, 0.5), L.kitchen.counterTop, 4);
  gloss(ctx, left + 40, cTop + 8, 30, 0.7);
  // On the counter: a cake stand on the left, a mixing bowl, a pot on the right.
  drawCake(ctx, left + 36, cTop, 1.05, 0xffb3c7);
  drawBody(ctx, box(left + 110, cTop - 44, 80, 46, 0.42), 0x8fd0f0, 4);
  drawBody(ctx, box(left + 104, cTop - 52, 92, 14, 0.5), shade(0x8fd0f0, 0.2), 3);
  gloss(ctx, left + 134, cTop - 22, 20, 0.8);
  const pot = right - 90;
  drawBody(ctx, box(pot - 44, cTop - 66, 88, 68, 0.3), C.kitchen.pot, 4);
  drawBody(ctx, box(pot - 52, cTop - 76, 104, 16, 0.5), C.kitchen.potDark, 3.5);
  drawBody(ctx, box(pot - 66, cTop - 52, 20, 10, 0.5), C.kitchen.potDark, 3);
  drawBody(ctx, box(pot + 46, cTop - 52, 20, 10, 0.5), C.kitchen.potDark, 3);
  gloss(ctx, pot - 20, cTop - 42, 24, 0.75);
  drawBody(ctx, disc(pot + 30, cTop - 92, 9), 0xffffff, 3);
  drawBody(ctx, disc(pot + 42, cTop - 112, 12), 0xffffff, 3);
  drawJar(ctx, right - 22, cTop - 46, 34, 44, C.kitchen.mug, 0xffe27a);
  drawPosts(ctx);
  flat(ctx, H.inset - 16, floor - 6, width - (H.inset - 16) * 2, 6, H.beam);
  drawSlab(ctx, 0);
  drawGround(ctx);
}

/** The awning over the shop window: stripes with a scalloped hem. */
function drawAwning(ctx: LandCtx, x: number, y: number, w: number): void {
  const stripe = 44;
  const count = Math.ceil(w / stripe);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const cx = x + i * stripe + stripe / 2;
    parts.push({ i, part: ovalPart(cx, y + 40, stripe / 2 + 1, 20) });
  }
  ctx.g.fillStyle(ctx.c(outlineColor(C.showcase.awningA)), 1);
  ctx.g.fillRect(x - 4, y - 4, w + 8, 44);
  for (const { i, part } of parts) {
    drawGroup(ctx, [part], i % 2 === 0 ? C.showcase.awningA : C.showcase.awningB, 3.5);
  }
  for (let i = 0; i < count; i++) {
    const color = i % 2 === 0 ? C.showcase.awningA : C.showcase.awningB;
    flat(ctx, x + i * stripe, y, Math.min(stripe, w - i * stripe), 42, color);
  }
  flat(ctx, x, y, w, 5, 0xffffff, 0.3);
}

/** The shop window of the second floor: glass with shelves of treats behind an awning. */
export function drawShowcase(ctx: LandCtx): void {
  const { width, height } = ctx;
  const left = H.inset + 28;
  const right = width - H.inset - 28;
  drawWall(ctx, 0xf8d9c0);
  flat(ctx, H.inset + 8, height - 96, width - (H.inset + 8) * 2, 96, shade(0xf8d9c0, -0.08));
  // The window.
  const wTop = 74;
  const wH = 190;
  drawBody(ctx, box(left, wTop, right - left, wH, 0.06), 0xffffff, 4.5);
  ctx.g.fillStyle(ctx.c(C.showcase.glass), 1);
  ctx.g.fillRect(left + 12, wTop + 12, right - left - 24, wH - 24);
  ctx.g.fillStyle(ctx.c(0xffffff), 0.45);
  fillPolygon(ctx.g, [
    { x: left + 80, y: wTop + 12 },
    { x: left + 128, y: wTop + 12 },
    { x: left + 60, y: wTop + wH - 12 },
    { x: left + 12, y: wTop + wH - 12 },
  ] as Pt[]);
  // Two shelves of treats: the lower is full, the upper only on the right (the sign hangs on the left).
  const lower = wTop + wH - 22;
  drawBody(ctx, box(left + 10, lower, right - left - 20, 14, 0.5), C.showcase.shelf, 3.5);
  const glazes = [0xffb3c7, 0xb9e4ff, 0xcdb8ff, 0xffe08a];
  for (let i = 0; i < 6; i++) {
    drawCake(ctx, left + 52 + i * 108, lower, 0.62, glazes[i % glazes.length] ?? 0xffb3c7);
  }
  const upper = wTop + 96;
  drawBody(ctx, box(left + 330, upper, right - left - 350, 12, 0.5), C.showcase.shelf, 3.5);
  for (let i = 0; i < 3; i++) {
    drawCake(ctx, left + 372 + i * 96, upper, 0.5, glazes[(i + 1) % glazes.length] ?? 0xffb3c7);
  }
  drawAwning(ctx, left - 14, 26, right - left + 28);
  // Planters under the window.
  for (let i = 0; i < 4; i++) {
    const x = left + 20 + i * 174;
    drawBody(ctx, box(x, height - 70, 130, 36, 0.2), C.showcase.shelf, 3.5);
    for (let k = 0; k < 4; k++) {
      drawBody(
        ctx,
        disc(x + 22 + k * 28, height - 80 - (k % 2) * 8, 11),
        glazes[(i + k) % glazes.length] ?? 0xffb3c7,
        2.5,
      );
    }
  }
  drawPosts(ctx);
  drawSlab(ctx, 0);
}

/** A mountain with a snow cap: the shadow half on the right, the cap with two drips. */
function drawPeak(ctx: LandCtx, x: number, top: number, half: number, back: boolean): void {
  const m = L.mountains;
  const bottom = ctx.height + 10;
  const rock = back ? m.rockBack : m.rock;
  const dark = back ? m.rockBackDark : m.rockDark;
  const apex: Pt[] = [
    { x: x - half * 0.09, y: top + half * 0.13 },
    { x: x - half * 0.035, y: top + half * 0.03 },
    { x: x + half * 0.035, y: top + half * 0.03 },
    { x: x + half * 0.09, y: top + half * 0.13 },
  ];
  const outline = [{ x: x - half, y: bottom }, ...apex, { x: x + half, y: bottom }];
  const rightHalf = [
    { x: x + 4, y: top + 3 },
    { x: x + 12, y: top + 20 },
    { x: x + half, y: bottom },
    { x, y: bottom },
  ];
  drawPoly(ctx, outline, rock, rightHalf, dark, 5);
  const capY = top + (bottom - top) * 0.26;
  const reach = (capY - top) / (bottom - top);
  const hw = half * reach;
  const cap: Pt[] = [
    ...apex,
    { x: x + hw, y: capY },
    { x: x + hw * 0.55, y: capY + 18 },
    { x: x + hw * 0.3, y: capY - 4 },
    { x: x - hw * 0.1, y: capY + 24 },
    { x: x - hw * 0.5, y: capY },
    { x: x - hw * 0.8, y: capY + 14 },
    { x: x - hw, y: capY },
  ];
  const capRight = [
    { x: x + 4, y: top + 3 },
    { x: x + 12, y: top + 20 },
    { x: x + hw, y: capY },
    { x: x + hw * 0.55, y: capY + 18 },
    { x: x + hw * 0.3, y: capY - 4 },
    { x, y: capY + 8 },
  ];
  drawPoly(ctx, cap, m.snow, capRight, m.snowDark, 3.5);
}

/** The roof of the house with mountains behind it, a chimney and its smoke. */
export function drawRoof(ctx: LandCtx): void {
  const { width, height } = ctx;
  const r = L.roof;
  for (const p of L.mountains.peaks) if (p.back) drawPeak(ctx, p.x, p.top, p.half, true);
  for (const p of L.mountains.peaks) if (!p.back) drawPeak(ctx, p.x, p.top, p.half, false);
  // Smoke curls up from the chimney.
  const ch = r.chimney;
  for (const [dx, dy, rad] of [
    [6, -4, 15],
    [20, -34, 19],
    [10, -70, 22],
  ] as const) {
    drawBody(ctx, disc(ch.x + ch.width / 2 + dx, ch.top + dy, rad), r.smoke, 3);
  }
  drawBody(ctx, box(ch.x, ch.top, ch.width, 140, 0.08), ch.brick, 4);
  for (let y = ch.top + 24; y < ch.top + 120; y += 24)
    flat(ctx, ch.x + 2, y, ch.width - 4, 3, ch.brickDark);
  drawBody(ctx, box(ch.x - 10, ch.top - 6, ch.width + 20, 20, 0.5), ch.cap, 3.5);
  // The roof: a trapezoid with rounded top corners, tile rows, a shadow side.
  const cx = width / 2;
  const topL = cx - r.topHalf;
  const topR = cx + r.topHalf;
  const footL = H.inset - r.overhang;
  const footR = width - H.inset + r.overhang;
  const hull: Pt[] = [
    { x: footL, y: height },
    { x: topL - 2, y: r.topY + 14 },
    { x: topL + 10, y: r.topY },
    { x: topR - 10, y: r.topY },
    { x: topR + 2, y: r.topY + 14 },
    { x: footR, y: height },
  ];
  const shadowSide: Pt[] = [
    { x: cx + 120, y: r.topY },
    { x: topR - 10, y: r.topY },
    { x: topR + 2, y: r.topY + 14 },
    { x: footR, y: height },
    { x: cx + 160, y: height },
  ];
  drawPoly(ctx, hull, r.tile, shadowSide, shade(r.tile, -0.12), 5);
  const edgeAt = (y: number, side: -1 | 1): number => {
    const t = (y - r.topY) / (height - r.topY);
    return side === -1 ? topL + (footL - topL) * t : topR + (footR - topR) * t;
  };
  let row = 0;
  for (let y = r.topY + 30; y < height - 14; y += r.rowHeight, row++) {
    const x0 = edgeAt(y, -1) + 30;
    const x1 = edgeAt(y, 1) - 30;
    for (let x = x0 + (row % 2) * 28; x < x1; x += 56) {
      drawBody(
        ctx,
        ovalPart(x, y, 27, 18),
        x > cx + 120 ? shade(r.tile, -0.08) : shade(r.tile, 0.1),
        2.5,
      );
    }
  }
  gloss(ctx, topL + 70, r.topY + 18, 34, 0.55);
  // The eave at the foot of the roof.
  drawBody(ctx, box(footL - 6, height - 16, footR - footL + 12, 22, 0.5), r.tileDark, 4);
}
