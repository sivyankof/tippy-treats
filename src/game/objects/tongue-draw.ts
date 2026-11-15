import type * as Phaser from 'phaser';
import { LICK } from '../../data/lick';
import { PALETTE } from '../../data/palette';
import { mixColor } from '../../util/color';
import type { Ribbon } from './tongue-ribbon';

const TWO_PI = Math.PI * 2;
/** The colours of the ribbon; the light stripe is pre-mixed, so a bend never doubles it. */
const COLORS = {
  outline: PALETTE.textDark,
  fill: LICK.tongue.fill,
  stripe: mixColor(LICK.tongue.fill, PALETTE.textLight, LICK.tongue.stripeAlpha),
  groove: LICK.tongue.groove,
} as const;

/** A band along the ribbon: its centre `across` (share of the width, right of travel is positive) and its width. */
interface Band {
  across: number;
  width: number;
  color: number;
}

/** The light stripe sits right of the middle (`stripeAt` is negative), the groove in the middle. */
const STRIPE: Band = {
  across: -LICK.tongue.stripeAt,
  width: LICK.tongue.stripeWidth,
  color: COLORS.stripe,
};
const GROOVE: Band = { across: 0, width: LICK.tongue.grooveWidth, color: COLORS.groove };
const TIP_BANDS: readonly Band[] = [STRIPE, GROOVE];

/** Where the corner of a piece sits: sample `k`, `reach` along the travel, `side` of the band edge. */
function cornerX(
  r: Ribbon,
  k: number,
  reach: number,
  side: number,
  band: Band,
  grow: number,
): number {
  const full = r.half[k]! * 2;
  const offset = band.across * full;
  const half = (band.width * full) / 2 + grow;
  return r.x[k]! + -r.ty[k]! * (offset + side * half) + r.tx[k]! * reach;
}

function cornerY(
  r: Ribbon,
  k: number,
  reach: number,
  side: number,
  band: Band,
  grow: number,
): number {
  const full = r.half[k]! * 2;
  const offset = band.across * full;
  const half = (band.width * full) / 2 + grow;
  return r.y[k]! + r.tx[k]! * (offset + side * half) + r.ty[k]! * reach;
}

/**
 * One piece of a band between samples `j - 1` and `j`, as a quad. `grow` widens the band on both
 * sides (the outline). Both ends reach `overlapPx` into the neighbours, so two pieces never meet
 * on a bare edge.
 */
function piece(
  g: Phaser.GameObjects.Graphics,
  r: Ribbon,
  j: number,
  band: Band,
  grow: number,
): void {
  const { overlapPx } = LICK.tongue.draw;
  // The root is not extended: it would stick out of the mouth behind the tongue.
  const back = j - 1 > 0 ? -overlapPx : 0;
  g.beginPath()
    .moveTo(cornerX(r, j - 1, back, 1, band, grow), cornerY(r, j - 1, back, 1, band, grow))
    .lineTo(cornerX(r, j, overlapPx, 1, band, grow), cornerY(r, j, overlapPx, 1, band, grow))
    .lineTo(cornerX(r, j, overlapPx, -1, band, grow), cornerY(r, j, overlapPx, -1, band, grow))
    .lineTo(cornerX(r, j - 1, back, -1, band, grow), cornerY(r, j - 1, back, -1, band, grow));
  g.closePath().fillPath();
}

/** The whole width of the ribbon as one band (scratch: its colour is set per pass). */
const WHOLE: Band = { across: 0, width: 1, color: 0 };

/**
 * The whole ribbon in one colour: a piece between every two samples and a round joint under each
 * (not at the root, and not near the tip, whose rim covers them), so any bend overlaps itself.
 */
function ribbonPass(g: Phaser.GameObjects.Graphics, r: Ribbon, color: number, grow: number): void {
  g.fillStyle(color, 1);
  const lastJoint = r.count - 1 - LICK.tongue.draw.sub;
  for (let j = 1; j < r.count; j++) {
    piece(g, r, j, WHOLE, grow);
    if (j <= lastJoint) g.fillCircle(r.x[j]!, r.y[j]!, r.half[j]! + grow);
  }
}

/** A stripe or the groove, one continuous line along the whole ribbon. */
function bandPass(g: Phaser.GameObjects.Graphics, r: Ribbon, band: Band): void {
  g.fillStyle(band.color, 1);
  for (let j = 1; j < r.count; j++) piece(g, r, j, band, 0);
}

/** Draws the body of the ribbon (outline, fill, light stripe, groove) into `g`. */
export function drawTongueBody(g: Phaser.GameObjects.Graphics, r: Ribbon): void {
  g.clear();
  ribbonPass(g, r, COLORS.outline, LICK.tongue.outline);
  ribbonPass(g, r, COLORS.fill, 0);
  bandPass(g, r, STRIPE);
  bandPass(g, r, GROOVE);
}

/** A polygon of an ellipse rotated along the tongue: centre, axes (unit vectors) and radii. */
function ellipse(
  g: Phaser.GameObjects.Graphics,
  c: { x: number; y: number },
  across: { x: number; y: number },
  along: { x: number; y: number },
  rAcross: number,
  rAlong: number,
  from: number,
  to: number,
  steps: number,
): void {
  g.beginPath();
  for (let s = 0; s <= steps; s++) {
    const a = from + ((to - from) * s) / steps;
    const u = Math.cos(a) * rAcross;
    const v = Math.sin(a) * rAlong;
    const x = c.x + across.x * u + along.x * v;
    const y = c.y + across.y * u + along.y * v;
    if (s === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath().fillPath();
}

const AXIS_ACROSS = { x: 0, y: 0 };
const AXIS_ALONG = { x: 0, y: 0 };
const CENTER = { x: 0, y: 0 };

/** One rim of the tip: a half ellipse grown by `grow`. */
function tipRim(
  g: Phaser.GameObjects.Graphics,
  half: number,
  height: number,
  grow: number,
  color: number,
): void {
  g.fillStyle(color, 1);
  ellipse(
    g,
    CENTER,
    AXIS_ACROSS,
    AXIS_ALONG,
    half + grow,
    height + grow,
    0,
    Math.PI,
    LICK.tongue.draw.tipSteps,
  );
}

/** A point of the tip in its own axes (`u` across, `v` along), as the start or a line of the path. */
function tipPoint(g: Phaser.GameObjects.Graphics, u: number, v: number, first: boolean): void {
  const x = CENTER.x + AXIS_ACROSS.x * u + AXIS_ALONG.x * v;
  const y = CENTER.y + AXIS_ACROSS.y * u + AXIS_ALONG.y * v;
  if (first) g.moveTo(x, y);
  else g.lineTo(x, y);
}

/**
 * The wide round tip on the last sample of `r`: a half ellipse as tall as `LICK.tongue.tipShare`
 * of the width, its rim, fill, the stripe and groove running on into it, and a shine.
 */
export function drawTongueTip(g: Phaser.GameObjects.Graphics, r: Ribbon): void {
  const { draw, outline, tipShare } = LICK.tongue;
  const k = r.count - 1;
  g.clear();
  AXIS_ALONG.x = r.tx[k]!;
  AXIS_ALONG.y = r.ty[k]!;
  AXIS_ACROSS.x = -r.ty[k]!;
  AXIS_ACROSS.y = r.tx[k]!;
  CENTER.x = r.x[k]!;
  CENTER.y = r.y[k]!;
  const half = r.half[k]!;
  const height = half * 2 * tipShare;
  tipRim(g, half, height, outline, COLORS.outline);
  tipRim(g, half, height, 0, COLORS.fill);
  // The stripe and the groove run on into the tip, a straight piece from the last sample.
  const reach = height * draw.tipStripeShare;
  for (let i = 0; i < TIP_BANDS.length; i++) {
    const band = TIP_BANDS[i]!;
    g.fillStyle(band.color, 1);
    const offset = band.across * half * 2;
    const w = (band.width * half * 2) / 2;
    const back = draw.overlapPx;
    g.beginPath();
    tipPoint(g, offset + w, -back, true);
    tipPoint(g, offset + w, reach, false);
    tipPoint(g, offset - w, reach, false);
    tipPoint(g, offset - w, -back, false);
    g.closePath().fillPath();
  }
  const s = draw.tipShine;
  g.fillStyle(PALETTE.textLight, s.alpha);
  CENTER.x += AXIS_ACROSS.x * half * 2 * s.across + AXIS_ALONG.x * height * s.along;
  CENTER.y += AXIS_ACROSS.y * half * 2 * s.across + AXIS_ALONG.y * height * s.along;
  ellipse(
    g,
    CENTER,
    AXIS_ACROSS,
    AXIS_ALONG,
    (half * 2 * s.w) / 2,
    (half * 2 * s.h) / 2,
    0,
    TWO_PI,
    s.steps,
  );
}
