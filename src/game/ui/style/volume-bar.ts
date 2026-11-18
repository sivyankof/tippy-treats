import type * as Phaser from 'phaser';
import { BAR_LOOK } from '../../../data/bar-look';
import { PALETTE } from '../../../data/palette';
import { shade } from '../../../util/color';
import { clamp01 } from '../../../util/math';
import { fillPolygon } from '../../fx/plain-style';
import {
  ARC_START,
  arcEnd,
  barFaceOutline,
  barRadius,
  capAngle,
  inset,
  type BarBox,
} from './bar-geometry';

export interface TrackLook {
  back: number;
  /** Opacity of the empty part (a see-through track of the run HUD uses less than 1). */
  alpha?: number;
}

/** The empty part of a bar: a rounded body with a darker upper half, like a groove. */
export function drawBarTrack(g: Phaser.GameObjects.Graphics, box: BarBox, look: TrackLook): void {
  const alpha = look.alpha ?? 1;
  const radius = Math.min(box.radius, box.height / 2);
  g.fillStyle(look.back, alpha).fillRoundedRect(box.left, box.top, box.width, box.height, radius);
  g.fillStyle(shade(look.back, BAR_LOOK.groove), alpha).fillRoundedRect(
    box.left,
    box.top,
    box.width,
    box.height / 2,
    { tl: radius, tr: radius, bl: 0, br: 0 },
  );
}

/**
 * A filled part with volume: the shade tone as the whole pill, the fill colour over it (the same pill cut off
 * above the shade) leaving a strip of shade along the bottom, and a pale gloss strip on top. `box.width` is the filled width.
 */
export function drawBarFill(g: Phaser.GameObjects.Graphics, box: BarBox, color: number): void {
  const { left, top, width, height } = box;
  const radius = barRadius(box);
  g.fillStyle(shade(color, BAR_LOOK.shade.amount), 1).fillRoundedRect(
    left,
    top,
    width,
    height,
    radius,
  );
  // The face is the shade pill cut off above the shade strip, so its ends follow the pill's curve.
  const faceHeight = height * (1 - BAR_LOOK.shade.share);
  g.fillStyle(color, 1);
  fillPolygon(g, barFaceOutline(box, faceHeight, BAR_LOOK.curveStepPx));
  const gloss = BAR_LOOK.gloss;
  const gh = height * gloss.share;
  if (width - radius <= 0 || gh < 1) return;
  g.fillStyle(PALETTE.textLight, gloss.alpha);
  g.fillRoundedRect(left + radius / 2, top + height * gloss.insetShare, width - radius, gh, gh / 2);
}

/** Centre of a ring and its geometry. */
export interface RingBox {
  cx: number;
  cy: number;
  /** Radius of the middle of the ring. */
  radius: number;
  ringWidth: number;
}

function strokeArc(
  g: Phaser.GameObjects.Graphics,
  ring: RingBox,
  radius: number,
  from: number,
  to: number,
): void {
  g.beginPath().arc(ring.cx, ring.cy, radius, from, to).strokePath();
}

function capAt(
  g: Phaser.GameObjects.Graphics,
  ring: RingBox,
  radius: number,
  angle: number,
  r: number,
): void {
  g.fillCircle(ring.cx + Math.cos(angle) * radius, ring.cy + Math.sin(angle) * radius, r);
}

/**
 * The arc variant of a bar: `share` of a full turn from twelve o'clock, clockwise, with the same
 * layers as `drawBarFill`: a dark outline, the shade tone, the fill colour on the outer side, a gloss stripe
 * along the outer edge and round caps. Draws nothing for an empty share.
 */
export function drawRingArc(
  g: Phaser.GameObjects.Graphics,
  ring: RingBox,
  share: number,
  color: number,
): void {
  const s = clamp01(share);
  if (s <= 0) return;
  const arc = BAR_LOOK.arc;
  const end = arcEnd(s);
  const w = ring.ringWidth;
  const layer = (width: number, radius: number, tone: number): void => {
    g.lineStyle(width, tone, 1);
    strokeArc(g, ring, radius, ARC_START, end);
    g.fillStyle(tone, 1);
    capAt(g, ring, radius, ARC_START, width / 2);
    capAt(g, ring, radius, end, width / 2);
  };
  layer(w + arc.outline * 2, ring.radius, shade(color, BAR_LOOK.shade.amount * 2.5));
  layer(w, ring.radius, shade(color, BAR_LOOK.shade.amount));
  // The face leaves the shade tone on the inner edge.
  const faceWidth = w * (1 - arc.shadeShare);
  const faceRadius = ring.radius + (w - faceWidth) / 2;
  layer(faceWidth, faceRadius, color);
  const cap = capAngle(ring.radius, w);
  const span = inset(s, cap);
  if (!span) return;
  const glossWidth = w * arc.gloss.share;
  const glossRadius = ring.radius + w / 2 - w * arc.gloss.inset - glossWidth / 2;
  g.lineStyle(glossWidth, PALETTE.textLight, arc.gloss.alpha);
  strokeArc(g, ring, glossRadius, span.from, span.to);
}
