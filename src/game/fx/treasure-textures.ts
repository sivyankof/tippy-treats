import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { RULE_ANIM } from '../../data/rule-anim';
import { TREASURE } from '../../data/treasure-anim';
import { bakeTexture } from '../ui/bake-texture';
import { bakeBerry } from './berry-texture';

/** Keys of the pictures of coins, berries and the zone rules. */
export const TREASURE_TEXTURES = {
  /** A gold coin; not meant for tinting. */
  coin: 'tr_coin',
  /** A glossy strawberry with a glow; not meant for tinting. */
  berry: 'tr_berry',
  /** One puff of a cloud bank; not meant for tinting. */
  cloud: 'tr_cloud',
  /** A speed streak: solid at the right end, gone at the left; white, for tinting. */
  streak: 'tr_streak',
  /** The outline of a rush layer, stretchable sideways; white, for tinting. */
  outline: 'tr_outline',
} as const;

const colors = TREASURE.colors;
const { shineAlpha, coinRingAlpha } = TREASURE.textures;
const OUTLINE_GLOW = RULE_ANIM.outline.glow;
const { slice: STREAK_SLICE, fadePower: STREAK_FADE_POWER } = RULE_ANIM.streaks;

/** Room around the outline stroke for its glow, on every side. */
export const OUTLINE_MARGIN = Math.ceil(
  (RULE_ANIM.outline.stroke * OUTLINE_GLOW[0].widthScale) / 2,
);
/** Height of the baked outline: the layer, the gap, the stroke and its glow on both sides. */
export const OUTLINE_HEIGHT = BALANCE.layer.height + 2 * (RULE_ANIM.outline.pad + OUTLINE_MARGIN);
/** Width of the middle strip of the baked outline, the part that is stretched. */
const OUTLINE_MIDDLE = 8;
/** Width of the baked outline: two caps and the middle strip. */
export const OUTLINE_WIDTH = RULE_ANIM.outline.slice * 2 + OUTLINE_MIDDLE;

function bakeCoin(scene: Phaser.Scene): void {
  const size = TREASURE.textures.coin;
  const c = size / 2;
  bakeTexture(scene, TREASURE_TEXTURES.coin, size, size, (g) => {
    g.fillStyle(colors.coinRim, 1).fillCircle(c, c, c - 1);
    g.fillStyle(colors.coinFace, 1).fillCircle(c, c, c * 0.84);
    g.lineStyle(size * 0.04, colors.coinRim, coinRingAlpha).strokeCircle(c, c, c * 0.62);
    // A diamond stamped in the middle.
    const reach = c * 0.42;
    g.fillStyle(colors.coinInner, 1);
    g.fillTriangle(c, c - reach, c + reach * 0.7, c, c - reach * 0.7, c);
    g.fillTriangle(c, c + reach, c + reach * 0.7, c, c - reach * 0.7, c);
    g.fillStyle(colors.coinShine, shineAlpha).fillCircle(c * 0.62, c * 0.6, c * 0.14);
  });
}

/** One cloud puff: a few overlapping blobs on a flat base, with a pale edge and a shaded belly. */
function bakeCloud(scene: Phaser.Scene): void {
  const { width, height } = RULE_ANIM.cloud.puff;
  const blobs = [
    { x: 0.34, y: 0.5, r: 0.24 },
    { x: 0.53, y: 0.45, r: 0.29 },
    { x: 0.7, y: 0.5, r: 0.23 },
    { x: 0.23, y: 0.54, r: 0.18 },
  ] as const;
  const { edge } = RULE_ANIM.cloud;
  const draw = (
    g: Phaser.GameObjects.Graphics,
    color: number,
    grow: number,
    dropY: number,
  ): void => {
    g.fillStyle(color, 1);
    for (const b of blobs) g.fillCircle(b.x * width, b.y * height + dropY, b.r * width + grow);
    g.fillRoundedRect(
      0.2 * width - grow,
      0.5 * height - grow + dropY,
      0.62 * width + grow * 2,
      0.3 * height + grow * 2,
      0.14 * height,
    );
  };
  bakeTexture(scene, TREASURE_TEXTURES.cloud, width, height, (g) => {
    draw(g, RULE_ANIM.colors.cloudEdge, edge, 0);
    draw(g, RULE_ANIM.colors.cloudShade, 0, 0);
    draw(g, RULE_ANIM.colors.cloud, 0, -height * 0.04);
  });
}

function bakeStreak(scene: Phaser.Scene): void {
  const { width, height } = RULE_ANIM.streaks;
  bakeTexture(scene, TREASURE_TEXTURES.streak, width, height, (g) => {
    for (let x = 0; x < width; x += STREAK_SLICE) {
      const k = (x + STREAK_SLICE / 2) / width;
      // The tail thins out as well as fading.
      const thick = height * (0.35 + 0.65 * k);
      g.fillStyle(0xffffff, Math.pow(k, STREAK_FADE_POWER));
      g.fillRect(x, (height - thick) / 2, STREAK_SLICE, thick);
    }
  });
}

function bakeOutline(scene: Phaser.Scene): void {
  const { pad, stroke } = RULE_ANIM.outline;
  const width = OUTLINE_WIDTH;
  const height = OUTLINE_HEIGHT;
  bakeTexture(scene, TREASURE_TEXTURES.outline, width, height, (g) => {
    const radius = ANIM.layer.cornerRadius + pad;
    for (const { widthScale, alpha } of OUTLINE_GLOW) {
      g.lineStyle(stroke * widthScale, 0xffffff, alpha).strokeRoundedRect(
        OUTLINE_MARGIN,
        OUTLINE_MARGIN,
        width - OUTLINE_MARGIN * 2,
        height - OUTLINE_MARGIN * 2,
        radius,
      );
    }
  });
}

/** Bakes the pictures of this track. Safe to call again: existing keys are kept. */
export function createTreasureTextures(scene: Phaser.Scene): void {
  bakeCoin(scene);
  bakeBerry(scene, TREASURE_TEXTURES.berry);
  bakeCloud(scene);
  bakeStreak(scene);
  bakeOutline(scene);
}
