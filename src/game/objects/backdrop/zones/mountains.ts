import * as Phaser from 'phaser';
import { MOUNTAIN_LOOK, MOUNTAIN_MOTION } from '../../../../data/backdrop/backdrop-mountains';
import { BACKDROP_COLORS } from '../../../../data/backdrop/backdrop-colors';
import { lerp, sineWave, smoothstep } from '../../../../util/math';
import { effectsMode } from '../../../effects-mode';
import {
  drawGlossMark,
  fillPolygon,
  fillOutlinedPolygon,
  outlineColor,
  type Pt,
} from '../../../fx/common/plain-style';
import { bakeTexture } from '../../../ui/bake-texture';
import type { FrameCtx, Life } from '../life/life';
import { inSky } from '../life/layer-anchor';
import { mountainRise } from './mountain-placement';

const L = MOUNTAIN_LOOK;
type Peak = (typeof L.peaks)[number];
type Graphics = Phaser.GameObjects.Graphics;
/** Tolerance when picking the points right of a peak's centre line. */
const SHADOW_EPS = 0.01;

/** Rounding of a peak's apex along each slope, px. */
function apexRadius(p: Peak): number {
  return Math.max(p.half * L.apexRound, L.outline * L.apexMinOutlines);
}

/** The rounded apex from the left slope to the right one (a quadratic curve through the corner). */
function apexCurve(p: Peak): Pt[] {
  const r = apexRadius(p);
  const slope = (L.height + L.overshoot - p.top) / p.half;
  const pts: Pt[] = [];
  for (let i = 0; i < L.apexPoints; i++) {
    const t = i / (L.apexPoints - 1);
    const u = 1 - t;
    // Ends on the slopes `r` px from the corner on each side, control point at the corner.
    pts.push({
      x: u * u * (p.x - r) + 2 * u * t * p.x + t * t * (p.x + r),
      y: (u * u + t * t) * (p.top + r * slope) + 2 * u * t * p.top,
    });
  }
  return pts;
}

/** The right half of the apex curve, from its top to the right slope. */
function apexRight(p: Peak): Pt[] {
  return apexCurve(p).slice((L.apexPoints - 1) / 2);
}

/** The silhouette of a peak with a rounded apex, from the left foot to the right foot (below the picture). */
function peakOutline(p: Peak): Pt[] {
  const bottom = L.height + L.overshoot;
  return [{ x: p.x - p.half, y: bottom }, ...apexCurve(p), { x: p.x + p.half, y: bottom }];
}

/** Half width of the peak at depth `y` of the picture. */
function halfAt(p: Peak, y: number): number {
  return (p.half * (y - p.top)) / (L.height + L.overshoot - p.top);
}

/** The snow cap: the rounded top of the peak with a lower edge that hangs in rounded drips, like icing. */
function capOutline(p: Peak, share: number): Pt[] {
  const capBase = p.top + (L.height - p.top) * share;
  const dripPx = (L.height - p.top) * share * L.dripShare;
  const steps = 24;
  const drips = L.dripDepths;
  const half = halfAt(p, capBase);
  const edge: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (drips.length - 1);
    const k = Math.min(Math.floor(t), drips.length - 2);
    const depth = lerp(drips[k] ?? 0, drips[k + 1] ?? 0, smoothstep(t - k));
    edge.push({ x: p.x - half + (2 * half * i) / steps, y: capBase + depth * dripPx });
  }
  // Apex left to right, down the right slope, the drip edge right to left, up the left slope.
  return [
    ...apexCurve(p),
    { x: p.x + half, y: capBase },
    ...edge.reverse(),
    { x: p.x - half, y: capBase },
  ];
}

/** Draws a polygon outlined in the dark tone of its fill, then its shadow side on top. */
function twoTone(
  g: Graphics,
  pts: readonly Pt[],
  shadowPts: readonly Pt[],
  fill: number,
  shadow: number,
  outline: number,
): void {
  fillOutlinedPolygon(g, pts, fill, outline, L.outline);
  g.fillStyle(shadow, 1);
  fillPolygon(g, shadowPts);
}

/** The right half of a peak silhouette: the side away from the light. */
function peakShadow(p: Peak): Pt[] {
  const bottom = L.height + L.overshoot;
  return [...apexRight(p), { x: p.x + p.half, y: bottom }, { x: p.x, y: bottom }];
}

/** The right half of a snow cap, from the top of its apex down to the drips right of the centre line. */
function capShadow(p: Peak, cap: readonly Pt[]): Pt[] {
  const rest = cap.slice(L.apexPoints).filter((pt) => pt.x >= p.x - SHADOW_EPS);
  return [...apexRight(p), ...rest];
}

function drawPeak(g: Graphics, p: Peak): void {
  const rock = p.back ? L.rockBack : L.rock;
  const dark = p.back ? L.rockBackDark : L.rockDark;
  twoTone(g, peakOutline(p), peakShadow(p), rock, dark, outlineColor(dark));
  const share = p.back ? L.capShareBack : L.capShareFront;
  const cap = capOutline(p, share);
  twoTone(g, cap, capShadow(p, cap), L.snow, L.snowDark, L.snowOutline);
  if (p.back) return;
  const m = L.gloss;
  drawGlossMark(g, {
    x: p.x - halfAt(p, p.top + (L.height - p.top) * share * 0.5) * m.dx * 2,
    y: p.top + (L.height - p.top) * share * m.dy,
    length: m.length,
    thick: m.thick,
    tilt: m.tilt,
    dotGap: m.dotGap,
    dotRadius: m.dotRadius,
    color: BACKDROP_COLORS.shared.white,
    alpha: L.glossAlpha,
  });
}

/** Bakes the mountain range: back peaks first, then the front ones with the strongest snow. */
export function bakeMountains(scene: Phaser.Scene): void {
  bakeTexture(scene, L.texture, L.width, L.height, (g) => {
    for (const peak of [...L.peaks].sort((a, b) => Number(b.back) - Number(a.back))) {
      drawPeak(g, peak);
    }
  });
}

/**
 * The range in the background of roof and clouds: one baked picture as wide as the screen that
 * rises from the bottom edge and sinks again with the tower height. Both zones carry the same
 * picture at the same place, so the zone cross-fade does not move it.
 */
export class Mountains implements Life {
  /** The mountains follow the tower's height themselves (`towerLayersAt`), far beyond any layer. */
  readonly anchor = inSky('mountains');
  readonly objects: Phaser.GameObjects.Image[];
  private readonly image: Phaser.GameObjects.Image;

  /** `tint` multiplies the picture (a weather's colour); `null` leaves it as baked. */
  constructor(scene: Phaser.Scene, tint: number | null = null) {
    this.image = new Phaser.GameObjects.Image(scene, 0, 0, L.texture).setOrigin(0.5, 1);
    if (tint !== null) this.image.setTint(tint);
    this.image.setVisible(false);
    this.objects = [this.image];
  }

  update(ctx: FrameCtx): void {
    const rise = mountainRise(ctx.towerLayers);
    this.image.setVisible(rise > 0);
    if (rise === 0) return;
    // Wider than the screen by the sway on both sides, so the edge never shows.
    const scale = Math.max(
      (MOUNTAIN_MOTION.heightShare * ctx.height) / L.height,
      (ctx.width + 2 * MOUNTAIN_MOTION.swayPx) / L.width,
    );
    // Sway only on full effects; lite and minimal place the range by the tower height alone.
    const sway = effectsMode.atMost('lite')
      ? 0
      : MOUNTAIN_MOTION.swayPx * sineWave(ctx.timeMs, MOUNTAIN_MOTION.swayPeriodMs);
    this.image.setScale(scale);
    this.image.setPosition(
      ctx.width / 2 + sway,
      ctx.height * MOUNTAIN_MOTION.bottomShare + (1 - rise) * L.height * scale,
    );
  }
}
