import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { RULE_ANIM } from '../../data/rule-anim';
import { TREASURE } from '../../data/treasure-anim';
import { bakeTexture } from '../ui/bake-texture';
import { bakeBerry } from './berry-texture';
import { shade } from '../../util/color';
import { OUTLINE_SHARE, drawGlossMark, glossFromShares } from './plain-style';

/** Keys of the pictures of coins, berries and the zone rules. */
export const TREASURE_TEXTURES = {
  /** A gold coin; not meant for tinting. */
  coin: 'tr_coin',
  /** A plain-layer style strawberry without a face: counters and price buttons; not meant for tinting. */
  berry: 'tr_berry',
  /** The same strawberry with the small face: reward windows, the Continue flight, the shop. */
  berryFace: 'tr_berry_face',
  /** One puff of a cloud bank; not meant for tinting. */
  cloud: 'tr_cloud',
  /** One puff of the space nebula bank (pink and blue, with star dots); not meant for tinting. */
  nebula: 'tr_nebula',
  /** A speed streak: solid at the right end, gone at the left; white, for tinting. */
  streak: 'tr_streak',
  /** The outline of a rush layer, stretchable sideways; white, for tinting. */
  outline: 'tr_outline',
} as const;

const colors = TREASURE.colors;
const coinLook = TREASURE.textures;
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

/** Fills the puff shape in `color` at `alpha`, grown by `grow` px and moved down by `dropY`. */
type PuffFill = (color: number, alpha: number, grow: number, dropY: number) => void;

/** What a puff painter gets: the fill, the puff size and the margin around it. */
interface PuffCanvas {
  g: Phaser.GameObjects.Graphics;
  fill: PuffFill;
  width: number;
  height: number;
  margin: number;
}

/**
 * One puff of a bank: a few overlapping blobs on a flat base, centred in a texture with a margin
 * for the soft edge. `paint` layers the colours (the cloud and the nebula paint it differently).
 */
function bakePuff(scene: Phaser.Scene, key: string, paint: (canvas: PuffCanvas) => void): void {
  const { width, height } = RULE_ANIM.cloud.puff;
  const { margin } = RULE_ANIM.cloud.halo;
  const blobs = [
    { x: 0.34, y: 0.5, r: 0.24 },
    { x: 0.53, y: 0.45, r: 0.29 },
    { x: 0.7, y: 0.5, r: 0.23 },
    { x: 0.23, y: 0.54, r: 0.18 },
  ] as const;
  bakeTexture(scene, key, width + margin * 2, height + margin * 2, (g) => {
    const fill: PuffFill = (color, alpha, grow, dropY) => {
      g.fillStyle(color, alpha);
      for (const b of blobs) {
        g.fillCircle(margin + b.x * width, margin + b.y * height + dropY, b.r * width + grow);
      }
      g.fillRoundedRect(
        margin + 0.2 * width - grow,
        margin + 0.5 * height - grow + dropY,
        0.62 * width + grow * 2,
        0.3 * height + grow * 2,
        0.14 * height + grow,
      );
    };
    paint({ g, fill, width, height, margin });
  });
}

/** A cloud puff: a pale edge, a shaded belly and a soft halo of fainter rings around it. */
function bakeCloud(scene: Phaser.Scene): void {
  const c = RULE_ANIM.colors;
  const { step, alphas } = RULE_ANIM.cloud.halo;
  const { edge } = RULE_ANIM.cloud;
  bakePuff(scene, TREASURE_TEXTURES.cloud, ({ fill, height }) => {
    // Outermost ring first: each ring is fainter and wider, so the edge fades out softly.
    for (let i = alphas.length - 1; i >= 0; i--) {
      fill(c.cloud, alphas[i] ?? 0, edge + step * (i + 1), 0);
    }
    fill(c.cloudEdge, 1, edge, 0);
    fill(c.cloudShade, 1, 0, 0);
    fill(c.cloud, 1, 0, -height * RULE_ANIM.cloud.lift);
  });
}

/**
 * The nebula puff: pink over blue, each colour a feathered shape (a stack of faint, shrinking
 * copies) instead of a hard-edged one, so overlapping puffs melt into one soft mass without rings
 * or a pale edge; a few star dots are baked in.
 */
function bakeNebula(scene: Phaser.Scene): void {
  const { colors, dots, lift, feather, bellyFadePx } = RULE_ANIM.cloud.nebula;
  bakePuff(scene, TREASURE_TEXTURES.nebula, ({ g, fill, width, height, margin }) => {
    // Each copy is smaller than the last; `riseFor` also lifts it, so the lowest copies are the
    // faintest: the pink top is only feathered, the blue belly also fades out downwards.
    const layer = (color: number, dropY: number, riseFor: (share: number) => number): void => {
      for (let k = 0; k < feather.rings; k++) {
        const share = k / (feather.rings - 1);
        fill(color, feather.alpha, feather.px * (1 - 2 * share), dropY - riseFor(share));
      }
    };
    layer(colors.blue, 0, (share) => bellyFadePx * share);
    layer(colors.pink, -height * lift, () => 0);
    g.fillStyle(colors.dot, 1);
    for (const d of dots) g.fillCircle(margin + d.x * width, margin + d.y * height, d.r * width);
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
  bakeBerry(scene, TREASURE_TEXTURES.berry, false);
  bakeBerry(scene, TREASURE_TEXTURES.berryFace, true);
  bakeCloud(scene);
  bakeNebula(scene);
  bakeStreak(scene);
  bakeOutline(scene);
}
