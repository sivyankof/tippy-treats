import * as Phaser from 'phaser';
import { MOUNTAIN_LOOK, MOUNTAIN_MOTION } from '../../../data/backdrop-mountains';
import { BACKDROP_COLORS } from '../../../data/backdrop-colors';
import { lerp, sineWave, smoothstep } from '../../../util/math';
import { effectsMode } from '../../effects-mode';
import {
  drawGlossMark,
  fillPolygon,
  fillOutlinedPolygon,
  outlineColor,
  type Pt,
} from '../../fx/plain-style';
import { bakeTexture } from '../../ui/bake-texture';
import type { FrameCtx, Life } from './life';
import { mountainRise } from './mountain-placement';

const L = MOUNTAIN_LOOK;
type Peak = (typeof L.peaks)[number];
type Graphics = Phaser.GameObjects.Graphics;
/** Tolerance when picking the points right of a peak's centre line. */
const SHADOW_EPS = 0.01;

/** The rounded silhouette of a peak, from the left foot to the right foot (below the picture). */
function peakOutline(p: Peak): Pt[] {
  const bottom = L.height + L.overshoot;
  const round = (p.half * 0.05) | 0;
  return [
    { x: p.x - p.half, y: bottom },
    { x: p.x - round, y: p.top + round * 1.6 },
    { x: p.x, y: p.top },
    { x: p.x + round, y: p.top + round * 1.6 },
    { x: p.x + p.half, y: bottom },
  ];
}

/** Half width of the peak at depth `y` of the picture. */
function halfAt(p: Peak, y: number): number {
  return (p.half * (y - p.top)) / (L.height + L.overshoot - p.top);
}

/** The snow cap: the top of the peak with a lower edge that hangs in rounded drips, like icing. */
function capOutline(p: Peak, share: number): Pt[] {
  const capBase = p.top + (L.height - p.top) * share;
  const dripPx = (L.height - p.top) * share * L.dripShare;
  const steps = 24;
  const drips = L.dripDepths;
  const pts: Pt[] = [{ x: p.x, y: p.top }];
  const half = halfAt(p, capBase);
  pts.push({ x: p.x - half, y: capBase });
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (drips.length - 1);
    const k = Math.min(Math.floor(t), drips.length - 2);
    const depth = lerp(drips[k] ?? 0, drips[k + 1] ?? 0, smoothstep(t - k));
    pts.push({ x: p.x - half + (2 * half * i) / steps, y: capBase + depth * dripPx });
  }
  pts.push({ x: p.x + half, y: capBase });
  return pts;
}

/** Draws a polygon outlined in the dark tone of its fill, then its shadow side on top. */
function twoTone(
  g: Graphics,
  pts: readonly Pt[],
  shadowPts: readonly Pt[],
  fill: number,
  shadow: number,
): void {
  fillOutlinedPolygon(g, pts, fill, outlineColor(fill), L.outline);
  g.fillStyle(shadow, 1);
  fillPolygon(g, shadowPts);
}

/** The right half of a peak silhouette: the side away from the light. */
function peakShadow(p: Peak): Pt[] {
  const o = peakOutline(p);
  return [o[2], o[3], o[4], { x: p.x, y: L.height + L.overshoot }].filter((pt): pt is Pt => !!pt);
}

/** The right half of a snow cap, from its apex to the right corner. */
function capShadow(p: Peak, cap: readonly Pt[]): Pt[] {
  const apex = cap[0];
  return [...(apex ? [apex] : []), ...cap.filter((pt, i) => i > 0 && pt.x >= p.x - SHADOW_EPS)];
}

function drawPeak(g: Graphics, p: Peak): void {
  const rock = p.back ? L.rockBack : L.rock;
  const dark = p.back ? L.rockBackDark : L.rockDark;
  twoTone(g, peakOutline(p), peakShadow(p), rock, dark);
  const share = p.back ? L.capShareBack : L.capShareFront;
  const cap = capOutline(p, share);
  twoTone(g, cap, capShadow(p, cap), L.snow, L.snowDark);
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
  readonly objects: Phaser.GameObjects.Image[];
  private readonly image: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.image = new Phaser.GameObjects.Image(scene, 0, 0, L.texture).setOrigin(0.5, 1);
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
