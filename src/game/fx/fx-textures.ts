import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { PALETTE } from '../../data/palette';
import { DEG_TO_RAD, TWO_PI } from '../../util/math';
import { bakeTexture } from '../ui/bake-texture';

/** Keys of the small shared effect textures. All are white and meant to be tinted. */
export const FX_TEXTURES = {
  glossBand: 'fx_gloss_band',
  drop: 'fx_drop',
  halo: 'fx_halo',
  circle: 'fx_circle',
  star: 'fx_star',
  crumb: 'fx_crumb',
  spark: 'fx_spark',
  confetti: 'fx_confetti',
  ring: 'fx_ring',
} as const;

/** Geometry of the baked shapes, in texture pixels. */
const GLOSS_HEIGHT = 128;
const DROP_WIDTH = ANIM.bite.dripSize;
const DROP_HEIGHT = Math.round(ANIM.bite.dripSize * 1.5);
const HALO_SIZE = 256;
/** Number of stacked circles that fake the radial falloff of the halo. */
const HALO_RINGS = 18;
/** Alpha of one ring; the centre accumulates all of them. */
const HALO_RING_ALPHA = 0.1;

/** Radii of the crumb outline in turn, as shares of its half size: an irregular blob. */
const CRUMB_RADII = [1, 0.78, 0.95, 0.7, 0.9, 0.82, 1, 0.75] as const;
/** Inner radius of the star as a share of the outer one. */
const STAR_INNER = 0.45;
const STAR_POINTS = 5;
/** Strokes of the ring, wide and faint to narrow and solid: a soft glow. */
const RING_GLOW: readonly { widthScale: number; alpha: number }[] = [
  { widthScale: 3, alpha: 0.15 },
  { widthScale: 2, alpha: 0.3 },
  { widthScale: 1, alpha: 1 },
];
const CONFETTI_RADIUS_SHARE = 0.25;
/** Diameter of the ring centre line in texture pixels; leaves room for the widest glow stroke. */
export const RING_DIAMETER =
  2 * (ANIM.fx.textures.ring.size / 2 - ANIM.fx.textures.ring.stroke * RING_GLOW[0]!.widthScale);

/** Fills a star-shaped polygon given by its outline radii from the centre, starting at `startDeg`. */
function fillFan(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radii: readonly number[],
  startDeg = -90,
): void {
  const step = TWO_PI / radii.length;
  const start = startDeg * DEG_TO_RAD;
  const point = (i: number) => {
    const r = radii[i % radii.length]!;
    const a = start + i * step;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  };
  for (let i = 0; i < radii.length; i++) {
    const a = point(i);
    const b = point(i + 1);
    g.fillTriangle(cx, cy, a.x, a.y, b.x, b.y);
  }
}

/** Bakes the shared effect textures. Safe to call again: existing keys are kept. */
export function createFxTextures(scene: Phaser.Scene): void {
  const white = PALETTE.textLight;

  const bandWidth = ANIM.perfect.glossSweepWidth;
  bakeTexture(scene, FX_TEXTURES.glossBand, bandWidth, GLOSS_HEIGHT, (g) => {
    g.fillStyle(white, 1).fillRoundedRect(0, 0, bandWidth, GLOSS_HEIGHT, bandWidth / 2);
  });

  // A teardrop: round bottom, pointed top.
  const radius = DROP_WIDTH / 2;
  bakeTexture(scene, FX_TEXTURES.drop, DROP_WIDTH, DROP_HEIGHT, (g) => {
    g.fillStyle(white, 1);
    g.fillCircle(radius, DROP_HEIGHT - radius, radius);
    g.fillTriangle(radius, 0, 0, DROP_HEIGHT - radius, DROP_WIDTH, DROP_HEIGHT - radius);
  });

  const half = HALO_SIZE / 2;
  bakeTexture(scene, FX_TEXTURES.halo, HALO_SIZE, HALO_SIZE, (g) => {
    g.fillStyle(white, HALO_RING_ALPHA);
    for (let i = 0; i < HALO_RINGS; i++) {
      g.fillCircle(half, half, half * (1 - i / HALO_RINGS));
    }
  });

  const sizes = ANIM.fx.textures;

  bakeTexture(scene, FX_TEXTURES.circle, sizes.circle, sizes.circle, (g) => {
    g.fillStyle(white, 1).fillCircle(sizes.circle / 2, sizes.circle / 2, sizes.circle / 2);
  });

  const starHalf = sizes.star / 2;
  const starRadii = Array.from({ length: STAR_POINTS * 2 }, (_, i) =>
    i % 2 === 0 ? starHalf : starHalf * STAR_INNER,
  );
  bakeTexture(scene, FX_TEXTURES.star, sizes.star, sizes.star, (g) => {
    g.fillStyle(white, 1);
    fillFan(g, starHalf, starHalf, starRadii);
  });

  const crumbHalf = sizes.crumb / 2;
  bakeTexture(scene, FX_TEXTURES.crumb, sizes.crumb, sizes.crumb, (g) => {
    g.fillStyle(white, 1);
    fillFan(
      g,
      crumbHalf,
      crumbHalf,
      CRUMB_RADII.map((r) => r * crumbHalf),
    );
  });

  // A thin diamond, long axis vertical.
  const { width: sparkW, height: sparkH } = sizes.spark;
  bakeTexture(scene, FX_TEXTURES.spark, sparkW, sparkH, (g) => {
    const cx = sparkW / 2;
    const cy = sparkH / 2;
    g.fillStyle(white, 1);
    g.fillTriangle(cx, 0, 0, cy, sparkW, cy);
    g.fillTriangle(cx, sparkH, 0, cy, sparkW, cy);
  });

  const { width: confettiW, height: confettiH } = sizes.confetti;
  bakeTexture(scene, FX_TEXTURES.confetti, confettiW, confettiH, (g) => {
    g.fillStyle(white, 1).fillRoundedRect(
      0,
      0,
      confettiW,
      confettiH,
      confettiW * CONFETTI_RADIUS_SHARE,
    );
  });

  const { size: ringSize, stroke } = sizes.ring;
  const ringHalf = ringSize / 2;
  bakeTexture(scene, FX_TEXTURES.ring, ringSize, ringSize, (g) => {
    const radius = RING_DIAMETER / 2;
    for (const { widthScale, alpha } of RING_GLOW) {
      g.lineStyle(stroke * widthScale, white, alpha).strokeCircle(ringHalf, ringHalf, radius);
    }
  });
}
