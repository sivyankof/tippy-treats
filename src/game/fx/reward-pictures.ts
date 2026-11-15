import type * as Phaser from 'phaser';
import { REWARD_LOOK } from '../../data/reward-look';
import { TWO_PI } from '../../util/math';
import { bakeTexture } from '../ui/bake-texture';
import { drawTwoToneBody, fillPolygon, outlineColor, roundShape } from './plain-style';

const look = REWARD_LOOK;

/** Keys of the reward pictures baked by `createRewardTextures`. */
export const REWARD_TEXTURES = { slot: 'reward_slot', tower: 'reward_tower' } as const;

function bakeSlot(scene: Phaser.Scene): void {
  const size = look.textureSize;
  const s = look.slot;
  const c = size / 2;
  const half = size * s.half;
  bakeTexture(scene, REWARD_TEXTURES.slot, size, size, (g) => {
    drawTwoToneBody(g, roundShape(s.radius * 2), c, c, half, half, {
      base: s.base,
      shadow: s.shadow,
      grow: look.outline,
      band: look.band,
    });
    // A dashed ring: the spot is still empty.
    const ring = half * s.ringShare;
    g.fillStyle(outlineColor(s.base), 0.7);
    for (let i = 0; i < s.dashes; i++) {
      const a = (TWO_PI * i) / s.dashes;
      g.fillCircle(c + Math.cos(a) * ring, c + Math.sin(a) * ring, s.dashThick / 2);
    }
    const plus = s.plus;
    const arm = size * plus.half;
    const thick = size * plus.thick;
    g.fillStyle(outlineColor(plus.color), 1);
    g.fillRoundedRect(c - arm - 3, c - thick / 2 - 3, arm * 2 + 6, thick + 6, thick / 2);
    g.fillRoundedRect(c - thick / 2 - 3, c - arm - 3, thick + 6, arm * 2 + 6, thick / 2);
    g.fillStyle(plus.color, 1);
    g.fillRoundedRect(c - arm, c - thick / 2, arm * 2, thick, thick / 2);
    g.fillRoundedRect(c - thick / 2, c - arm, thick, arm * 2, thick / 2);
  });
}

function bakeTower(scene: Phaser.Scene): void {
  const size = look.textureSize;
  const c = size / 2;
  const t = look.tower;
  bakeTexture(scene, REWARD_TEXTURES.tower, size, size, (g) => {
    for (const tier of t.tiers) {
      drawTwoToneBody(
        g,
        roundShape(1),
        c + tier.x * size,
        c + tier.y * size,
        tier.rx * size,
        tier.ry * size,
        {
          base: tier.base,
          shadow: tier.shadow,
          grow: look.outline,
          band: look.band,
        },
      );
    }
    const sh = t.sheet;
    const rx = sh.rx * size;
    const ry = sh.ry * size;
    const cy = c + sh.y * size;
    drawTwoToneBody(g, roundShape(0.3), c, cy, rx, ry, {
      base: sh.base,
      shadow: sh.shadow,
      grow: look.outline,
      band: look.band,
    });
    // The head strip of the sheet and two lines of "dates".
    const headH = ry * 2 * sh.headShare;
    g.fillStyle(sh.head, 1);
    fillPolygon(g, [
      { x: c - rx, y: cy - ry },
      { x: c + rx, y: cy - ry },
      { x: c + rx, y: cy - ry + headH },
      { x: c - rx, y: cy - ry + headH },
    ]);
    g.lineStyle(look.outline * 0.6, sh.line, 1);
    for (let i = 0; i < sh.lineCount; i++) {
      const y = cy - ry + headH + ((ry * 2 - headH) * (i + 1)) / (sh.lineCount + 1);
      g.lineBetween(c - rx * 0.6, y, c + rx * 0.6, y);
    }
    g.lineStyle(look.outline * 0.8, outlineColor(sh.head), 1);
    g.lineBetween(c - rx, cy - ry + headH, c + rx, cy - ry + headH);
  });
}

/** Bakes the pictures of the rewards that are not creatures, coins or berries. Safe to call again. */
export function createRewardTextures(scene: Phaser.Scene): void {
  bakeSlot(scene);
  bakeTower(scene);
}
