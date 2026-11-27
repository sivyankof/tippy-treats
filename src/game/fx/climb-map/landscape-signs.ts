import {
  CLIMB_LANDSCAPE,
  type LandscapeKind,
  type SignKind,
} from '../../../data/progression/climb-landscape';
import { shade } from '../../../util/color';
import {
  box,
  cloudParts,
  disc,
  drawBody,
  drawGroup,
  drawLock,
  drawSparkle,
  gloss,
  type LandCtx,
  type Part,
} from './landscape-kit';
import { signRect } from './landscape-math';

const S = CLIMB_LANDSCAPE.sign;

/** Which sign a kind of picture carries. */
export function signKindOf(kind: LandscapeKind): SignKind {
  if (kind === 'clouds') return 'cloud';
  if (kind === 'stars' || kind === 'lap') return 'star';
  return 'wood';
}

/** A wooden signboard: two hangers, a plank with grain and nails. */
function drawWood(ctx: LandCtx, x: number, y: number, w: number, h: number): void {
  const { g, c } = ctx;
  const k = S.wood;
  g.lineStyle(4, c(shade(k.fill, -0.5)), 1);
  for (const px of [x + 30, x + w - 30]) {
    g.beginPath();
    g.moveTo(px, y - 22);
    g.lineTo(px, y + 8);
    g.strokePath();
  }
  drawBody(ctx, box(x, y, w, h, 0.16), k.fill);
  drawBody(ctx, box(x + 10, y + 10, w - 20, h - 22, 0.1), k.plank, 2.5);
  g.fillStyle(c(shade(k.plank, -0.16)), 1);
  for (const dy of [0.3, 0.52, 0.8]) g.fillRect(x + 22, y + h * dy, w * 0.22, 3);
  g.fillRect(x + w * 0.7, y + h * 0.4, w * 0.18, 3);
  for (const nx of [x + 16, x + w - 16]) {
    drawBody(ctx, disc(nx, y + 16, 3.5), k.nail, 1.5);
    drawBody(ctx, disc(nx, y + h - 16, 3.5), k.nail, 1.5);
  }
  gloss(ctx, x + 44, y + 17, 26, 0.55);
}

/** A little cloud as a plate. */
function drawCloudSign(ctx: LandCtx, x: number, y: number, w: number, h: number): void {
  const k = S.cloud;
  const s = Math.min(w / 196, h / 92);
  const cx = x + w / 2;
  const cy = y + h * 0.5 + 6;
  const parts: Part[] = cloudParts(cx, cy, s);
  drawGroup(ctx, parts, k.fill);
  gloss(ctx, cx - 46 * s, cy - 24 * s, 24 * s, 0.85);
}

/** A night-blue plate with a gold rim and small stars at the corners. */
function drawStarSign(ctx: LandCtx, x: number, y: number, w: number, h: number): void {
  const k = S.star;
  drawBody(ctx, box(x, y, w, h, 0.22), k.rim);
  drawBody(ctx, box(x + 8, y + 8, w - 16, h - 16, 0.2), k.fill, 2.5);
  drawSparkle(ctx, x + 18, y + 18, 9, 0xffe27a);
  drawSparkle(ctx, x + w - 16, y + h - 18, 7, 0xffe27a);
  gloss(ctx, x + 40, y + 20, 24, 0.5);
}

/** The plate of a shut picture: pale lilac with a lock on the left. */
function drawShutSign(ctx: LandCtx, x: number, y: number, w: number, h: number): void {
  const k = S.shut;
  drawBody(ctx, box(x, y, w, h, 0.25), k.fill);
  drawLock(ctx, x + 52, y + h / 2 - 2, 58, k.lock);
  gloss(ctx, x + 40, y + 16, 24, 0.7);
}

/** Draws the sign a picture carries; the text is put on it when the ribbon is built. */
export function drawSign(ctx: LandCtx, kind: LandscapeKind, shut: boolean): void {
  const r = signRect(kind, shut);
  if (shut) drawShutSign(ctx, r.x, r.y, r.width, r.height);
  else {
    const sign = signKindOf(kind);
    if (sign === 'wood') drawWood(ctx, r.x, r.y, r.width, r.height);
    else if (sign === 'cloud') drawCloudSign(ctx, r.x, r.y, r.width, r.height);
    else drawStarSign(ctx, r.x, r.y, r.width, r.height);
  }
}
