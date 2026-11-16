import type * as Phaser from 'phaser';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { PALETTE } from '../../../data/palette';
import { RAINBOW_LOOK } from '../../../data/rainbow-look';
import { paintStar } from '../../objects/creature-art/rainbow';
import { starPoints } from '../../objects/creature-art/rainbow-geometry';
import { bakeTexture } from '../../ui/bake-texture';
import { fillPolygon, outlineColor } from '../plain-style';

/** Baked pictures of the Rainbow: the moving parts are shown by turning and scaling these, not by redrawing. */
export const RAINBOW_TEXTURES = {
  /** The gold crown star of an awake Rainbow layer, centred. */
  star: 'fx_rainbow_star',
  /** The white four-point sparkle of the star's flash, centred. */
  sparkle: 'fx_rainbow_sparkle',
  /** The cream cloud with a face at the foot of the ability arc, centred on its puff. */
  cloudFace: 'fx_rainbow_cloud_face',
  /** The same cloud without a face, at the far end of the arc. */
  cloud: 'fx_rainbow_cloud',
} as const;

const { star, idle } = RAINBOW_LOOK;
const cloud = ABILITY_ANIM.rainbow.cloud;
/** Spare pixels around every picture, so antialiased edges are not cut. */
const PAD = 2;
/** The star is baked at its largest (flash) size and shown smaller at rest. */
export const STAR_BAKE_SCALE = 1 + idle.sparkleScale;
const SPARKLE_POINTS = 4;

/** Half the side of the star picture at bake scale. */
const STAR_HALF = Math.ceil((star.radius + star.outline + PAD) * STAR_BAKE_SCALE);
const SPARKLE_HALF = Math.ceil(star.radius * idle.sparkleSize + PAD);

/** How far the cloud lumps (with their outline) reach from the centre at scale 1. */
function cloudReach(): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const [dx, dy, lr] of cloud.lumps) {
    x = Math.max(x, Math.abs(dx) + lr);
    y = Math.max(y, Math.abs(dy) + lr);
  }
  return { x: x * cloud.radius + cloud.outlinePx, y: y * cloud.radius + cloud.outlinePx };
}

/** A cream cloud of lumps with an outline at (0, 0), radius `cloud.radius`; with a face on demand. */
function paintCloud(g: Phaser.GameObjects.Graphics, face: boolean): void {
  const r = cloud.radius;
  const line = outlineColor(cloud.fill);
  g.fillStyle(line, 1);
  for (const [dx, dy, lr] of cloud.lumps) g.fillCircle(dx * r, dy * r, lr * r + cloud.outlinePx);
  g.fillStyle(cloud.fill, 1);
  for (const [dx, dy, lr] of cloud.lumps) g.fillCircle(dx * r, dy * r, lr * r);
  if (!face) return;
  g.fillStyle(line, 1);
  for (const s of [-1, 1]) g.fillCircle(s * cloud.eye.x * r, cloud.eye.y * r, cloud.eye.radius * r);
  g.lineStyle(cloud.smile.thick, line, 1).beginPath();
  g.arc(0, cloud.smile.y * r, cloud.smile.radius * r, 0.2, Math.PI - 0.2);
  g.strokePath();
}

/** Bakes the Rainbow pictures. Safe to call again: existing keys are kept. */
export function bakeRainbowTextures(scene: Phaser.Scene): void {
  const side = STAR_HALF * 2;
  bakeTexture(scene, RAINBOW_TEXTURES.star, side, side, (g) => {
    g.translateCanvas(STAR_HALF, STAR_HALF);
    g.scaleCanvas(STAR_BAKE_SCALE, STAR_BAKE_SCALE);
    paintStar(g, 0);
  });
  const sparkleSide = SPARKLE_HALF * 2;
  bakeTexture(scene, RAINBOW_TEXTURES.sparkle, sparkleSide, sparkleSide, (g) => {
    g.fillStyle(PALETTE.textLight, 1);
    fillPolygon(
      g,
      starPoints(
        SPARKLE_HALF,
        SPARKLE_HALF,
        star.radius * idle.sparkleSize,
        idle.sparkleNotch,
        SPARKLE_POINTS,
      ),
    );
  });
  const reach = cloudReach();
  const halfW = Math.ceil((reach.x + PAD) * cloud.bakeScale);
  const halfH = Math.ceil((reach.y + PAD) * cloud.bakeScale);
  for (const face of [true, false]) {
    const key = face ? RAINBOW_TEXTURES.cloudFace : RAINBOW_TEXTURES.cloud;
    bakeTexture(scene, key, halfW * 2, halfH * 2, (g) => {
      g.translateCanvas(halfW, halfH);
      g.scaleCanvas(cloud.bakeScale, cloud.bakeScale);
      paintCloud(g, face);
    });
  }
}
