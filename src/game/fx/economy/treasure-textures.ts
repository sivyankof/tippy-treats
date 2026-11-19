import type * as Phaser from 'phaser';
import { ANIM } from '../../../data/common/anim';
import { BALANCE } from '../../../data/tower/balance';
import { RULE_ANIM } from '../../../data/zones/rule-anim';
import { TREASURE } from '../../../data/economy/treasure-anim';
import { bakeTexture } from '../../ui/bake-texture';
import { bakeBerry } from './berry-texture';
import { shade } from '../../../util/color';
import { bakeCloudFigure } from '../zones/cloud-figure';
import { OUTLINE_SHARE, drawGlossMark, glossFromShares } from '../common/plain-style';

/** Keys of the pictures of coins, berries and the zone rules. */
export const TREASURE_TEXTURES = {
  /** A gold coin; not meant for tinting. */
  coin: 'tr_coin',
  /** A plain-layer style strawberry without a face: counters and price buttons; not meant for tinting. */
  berry: 'tr_berry',
  /** The same strawberry with the small face: reward windows, the Continue flight, the shop. */
  berryFace: 'tr_berry_face',
  /** The cloud of the clouds zone: one whole figure; not meant for tinting. */
  cloud: 'tr_cloud',
  /** The nebula of Space: the veil and the two arms, three frames of one texture (`nebula-arms.ts`); not meant for tinting. */
  nebula: 'tr_nebula',
  /** A speed streak: solid at the right end, gone at the left; white, for tinting. */
  streak: 'tr_streak',
  /** The outline of a rush layer, stretchable sideways; white, for tinting. */
  outline: 'tr_outline',
} as const;

const colors = TREASURE.colors;
const coinLook = TREASURE.textures;
const OUTLINE_GLOW = RULE_ANIM.outline.glow;
const {
  slice: STREAK_SLICE,
  fadePower: STREAK_FADE_POWER,
  headShare: STREAK_HEAD_SHARE,
  tailThickness: STREAK_TAIL_THICKNESS,
} = RULE_ANIM.streaks;

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
  const size = coinLook.coin;
  const c = size / 2;
  const outline = size * OUTLINE_SHARE;
  const faceR = c * coinLook.coinFaceShare;
  const band = faceR * coinLook.coinBandShare;
  bakeTexture(scene, TREASURE_TEXTURES.coin, size, size, (g) => {
    g.fillStyle(shade(colors.coinRim, coinLook.coinOutlineShade), 1).fillCircle(c, c, c);
    g.fillStyle(colors.coinRim, 1).fillCircle(c, c, c - outline);
    // The face: a flat shadow band, with the lit disc pushed to the top left over it.
    g.fillStyle(colors.coinShade, 1).fillCircle(c, c, faceR);
    g.fillStyle(colors.coinFace, 1).fillCircle(c - band, c - band, faceR - band);
    g.lineStyle(size * coinLook.coinRingWidth, colors.coinRim, 1);
    g.strokeCircle(c - band / 2, c - band / 2, c * coinLook.coinRingShare);
    // A diamond stamped in the middle.
    const reach = c * 0.42;
    g.fillStyle(colors.coinInner, 1);
    g.fillTriangle(c, c - reach, c + reach * 0.7, c, c - reach * 0.7, c);
    g.fillTriangle(c, c + reach, c + reach * 0.7, c, c - reach * 0.7, c);
    const shine = coinLook.coinShine;
    drawGlossMark(g, glossFromShares(shine, c, c, c, colors.coinShine, coinLook.shineAlpha));
  });
}

function bakeStreak(scene: Phaser.Scene): void {
  const { width, height } = RULE_ANIM.streaks;
  bakeTexture(scene, TREASURE_TEXTURES.streak, width, height, (g) => {
    for (let x = 0; x < width; x += STREAK_SLICE) {
      const k = (x + STREAK_SLICE / 2) / width;
      // The tail thins out as well as fading, and the head is rounded.
      const round =
        k > 1 - STREAK_HEAD_SHARE
          ? Math.sqrt(Math.max(0, 1 - ((k - (1 - STREAK_HEAD_SHARE)) / STREAK_HEAD_SHARE) ** 2))
          : 1;
      const thick = height * (STREAK_TAIL_THICKNESS + (1 - STREAK_TAIL_THICKNESS) * k) * round;
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
  bakeBerry(scene, TREASURE_TEXTURES.berry, false);
  bakeBerry(scene, TREASURE_TEXTURES.berryFace, true);
  bakeCloudFigure(scene, TREASURE_TEXTURES.cloud);
  bakeStreak(scene);
  bakeOutline(scene);
}
