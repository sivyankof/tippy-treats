import type * as Phaser from 'phaser';
import { ANIM } from '../../../data/common/anim';
import { PALETTE } from '../../../data/common/palette';
import { LICK } from '../../../data/glaze/lick';
import { TRANSFORM } from '../../../data/creatures/transform-scene';
import { DEG_TO_RAD, TWO_PI } from '../../../util/math';
import { bakeTexture } from '../../ui/common/bake-texture';
import { bakeGrownAccentTextures } from '../creatures/grown-accent-textures';

/** Keys of the small shared effect textures. All are white and meant to be tinted, except the heart. */
export const FX_TEXTURES = {
  glossBand: 'fx_gloss_band',
  drop: 'fx_drop',
  /** The same teardrop baked big and padded, for drops that fly and are scaled up. */
  dropBig: 'fx_drop_big',
  halo: 'fx_halo',
  circle: 'fx_circle',
  star: 'fx_star',
  crumb: 'fx_crumb',
  spark: 'fx_spark',
  confetti: 'fx_confetti',
  ring: 'fx_ring',
  /** Flat gold rim of the transform flash, in its own colours. */
  rim: 'fx_rim',
  /** Round puff lobe: white with a warm outline, in its own colours. */
  puffLobe: 'fx_puff_lobe',
  /** A pink heart with a dark outline and a shine, drawn in its own colours. */
  heart: 'fx_heart',
} as const;

/** The heart: two round lobes over a point, as shares of its size. */
const HEART_LOBE = { x: 0.28, y: 0.33, r: 0.25 } as const;
const HEART_TIP_Y = 0.92;
const HEART_SHINE = { x: 0.27, y: 0.3, w: 0.16, h: 0.12 } as const;

/** Geometry of the baked shapes, in texture pixels. */
const GLOSS_HEIGHT = 128;
const DROP_WIDTH = ANIM.bite.dripSize;
const DROP_HEIGHT = Math.round(ANIM.bite.dripSize * 1.5);
/** The big drop is baked this many times larger than the small one, with an empty rim so its smooth edge is never cut by the texture border. */
export const DROP_BIG_SCALE = 3;
const DROP_BIG_PAD = 3;
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

/** Outline radii of a five-pointed star of outer radius `outer`, points and notches in turn. */
export function starRadii(outer: number): number[] {
  return Array.from({ length: STAR_POINTS * 2 }, (_, i) =>
    i % 2 === 0 ? outer : outer * STAR_INNER,
  );
}

/** Fills a star-shaped polygon given by its outline radii from the centre, starting at `startDeg`. */
export function fillFan(
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

  const bigW = DROP_WIDTH * DROP_BIG_SCALE;
  const bigH = DROP_HEIGHT * DROP_BIG_SCALE;
  const bigRadius = bigW / 2;
  bakeTexture(scene, FX_TEXTURES.dropBig, bigW + DROP_BIG_PAD * 2, bigH + DROP_BIG_PAD * 2, (g) => {
    g.fillStyle(white, 1);
    g.translateCanvas(DROP_BIG_PAD, DROP_BIG_PAD);
    g.fillCircle(bigRadius, bigH - bigRadius, bigRadius);
    g.fillTriangle(bigRadius, 0, 0, bigH - bigRadius, bigW, bigH - bigRadius);
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
  bakeTexture(scene, FX_TEXTURES.star, sizes.star, sizes.star, (g) => {
    g.fillStyle(white, 1);
    fillFan(g, starHalf, starHalf, starRadii(starHalf));
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

  const { rim, puff } = TRANSFORM;
  const rimHalf = rim.size / 2;
  const rimRadius = rimHalf - rim.width / 2 - rim.outlineWidth;
  bakeTexture(scene, FX_TEXTURES.rim, rim.size, rim.size, (g) => {
    g.lineStyle(rim.width + rim.outlineWidth * 2, rim.outline, 1).strokeCircle(
      rimHalf,
      rimHalf,
      rimRadius,
    );
    g.lineStyle(rim.width, rim.fill, 1).strokeCircle(rimHalf, rimHalf, rimRadius);
  });

  const lobeSize = puff.textureSize;
  const lobeHalf = lobeSize / 2;
  bakeTexture(scene, FX_TEXTURES.puffLobe, lobeSize, lobeSize, (g) => {
    g.fillStyle(puff.outline, 1).fillCircle(lobeHalf, lobeHalf, lobeHalf);
    g.fillStyle(puff.fill, 1).fillCircle(
      lobeHalf,
      lobeHalf,
      lobeHalf * (1 - puff.outlineWidth / (puff.radius + puff.outlineWidth)),
    );
  });

  const { size: heartSize, outline: heartOutline } = LICK.heart;
  bakeTexture(scene, FX_TEXTURES.heart, heartSize, heartSize, (g) => {
    const shape = (inset: number): void => {
      const r = heartSize * HEART_LOBE.r - inset;
      const lx = heartSize * HEART_LOBE.x;
      const ly = heartSize * HEART_LOBE.y;
      g.fillCircle(lx, ly, r).fillCircle(heartSize - lx, ly, r);
      const side = lx - r * Math.SQRT1_2;
      g.fillTriangle(
        side,
        ly + r * Math.SQRT1_2,
        heartSize - side,
        ly + r * Math.SQRT1_2,
        heartSize / 2,
        heartSize * HEART_TIP_Y - inset * Math.SQRT2,
      );
      g.fillRect(lx, ly - r * 0.2, heartSize - lx * 2, r);
    };
    g.fillStyle(PALETTE.textDark, 1);
    shape(0);
    g.fillStyle(PALETTE.accent, 1);
    shape(heartOutline);
    g.fillStyle(white, 0.85).fillEllipse(
      heartSize * HEART_SHINE.x,
      heartSize * HEART_SHINE.y,
      heartSize * HEART_SHINE.w,
      heartSize * HEART_SHINE.h,
    );
  });
  bakeGrownAccentTextures(scene);
}
