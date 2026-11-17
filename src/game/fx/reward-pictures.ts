import type * as Phaser from 'phaser';
import { REWARD_LOOK } from '../../data/reward-look';
import { paddedScale } from '../../util/field-pad';
import { TWO_PI } from '../../util/math';
import { FIELD_PAD } from '../../data/picture-fields';
import { bakePadded, bakeTexture } from '../ui/bake-texture';
import {
  drawGlossMark,
  drawTwoToneBody,
  fillPolygon,
  glossFromShares,
  outlineColor,
  OUTLINE_SHARE,
  roundShape,
} from './plain-style';

const look = REWARD_LOOK;

/** How many times bigger the picture of the tower is than its drawing (the room around it): show it this much bigger to keep the drawing at its size. */
export const REWARD_TOWER_FIELD_SCALE = paddedScale(look.textureSize, FIELD_PAD.rewardTower);

/** Keys of the reward pictures baked by `createRewardTextures`. */
export const REWARD_TEXTURES = {
  slot: 'reward_slot',
  tower: 'reward_tower',
  check: 'reward_check',
  ticketFree: 'reward_ticket_free',
  ticketUsed: 'reward_ticket_used',
} as const;

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
  bakePadded(scene, REWARD_TEXTURES.tower, size, size, FIELD_PAD.rewardTower, (g) => {
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

function bakeCheck(scene: Phaser.Scene): void {
  const c = look.check;
  const r = c.size / 2;
  bakeTexture(scene, REWARD_TEXTURES.check, c.size, c.size, (g) => {
    const grow = c.size * OUTLINE_SHARE;
    drawTwoToneBody(g, roundShape(1), r, r, r - grow, r - grow, {
      base: c.base,
      shadow: c.shadow,
      grow,
      band: look.band,
    });
    g.lineStyle(c.size * c.markThick, c.mark, 1);
    g.beginPath();
    g.moveTo(r - r * 0.42, r + r * 0.02);
    g.lineTo(r - r * 0.1, r + r * 0.34);
    g.lineTo(r + r * 0.46, r - r * 0.3);
    g.strokePath();
  });
}

/** One attempt ticket: a flat sponge with a glaze cap, drips, a perforation and a gloss mark (free only). */
function bakeTicket(scene: Phaser.Scene, key: string, used: boolean): void {
  const k = look.ticket;
  const colors = used ? k.used : k.free;
  const w = k.width;
  const h = k.height;
  const flat = used ? k.usedFlatten : 1;
  const c = w / 2;
  const cy = h / 2 + (used ? k.usedDrop * h : 0);
  bakeTexture(scene, key, w, h, (g) => {
    const spongeRy = k.spongeRy * h * flat;
    drawTwoToneBody(g, roundShape(0.7), c, cy, w / 2 - k.outline, spongeRy, {
      base: colors.cake,
      shadow: colors.cakeShadow,
      grow: k.outline,
      band: k.band,
    });
    // Perforation: a column of dots near the right end, in the dark tone of the sponge.
    g.fillStyle(outlineColor(colors.cake), 0.7);
    for (let i = 0; i < k.perforationDots; i++) {
      const y = cy - spongeRy * 0.8 + (spongeRy * 1.6 * (i + 0.5)) / k.perforationDots;
      g.fillCircle(c + k.perforationX * w, y, k.perforationRadius * w);
    }
    // Drips under the glaze cap, then the cap itself.
    const capRy = k.capRy * h * flat;
    const capY = cy + k.capY * h * flat;
    for (const dx of k.drips) {
      const x = c + dx * w;
      const y = capY + capRy;
      g.fillStyle(outlineColor(colors.glaze), 1).fillCircle(
        x,
        y,
        k.dripRadius * w + k.outline * 0.8,
      );
      g.fillStyle(colors.glaze, 1).fillCircle(x, y, k.dripRadius * w);
    }
    drawTwoToneBody(g, roundShape(1), c, capY, w / 2 - k.outline - k.capInset * w, capRy, {
      base: colors.glaze,
      shadow: colors.glazeShadow,
      grow: k.outline,
      band: k.band,
    });
    if (!used) {
      drawGlossMark(g, glossFromShares(k.gloss, c, capY, w, 0xffffff, 0.9, { x: w, y: h }));
    }
  });
}

/** Bakes the pictures of the rewards that are not creatures, coins or berries. Safe to call again. */
export function createRewardTextures(scene: Phaser.Scene): void {
  bakeSlot(scene);
  bakeTower(scene);
  bakeCheck(scene);
  bakeTicket(scene, REWARD_TEXTURES.ticketFree, false);
  bakeTicket(scene, REWARD_TEXTURES.ticketUsed, true);
}
