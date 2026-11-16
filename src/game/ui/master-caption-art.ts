import type * as Phaser from 'phaser';
import type { CreatureId } from '../../data/creatures';
import { MASTER_ANIM } from '../../data/master-anim';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { cssColor } from '../../util/color';
import { fillFan, starRadii } from '../fx/fx-textures';
import { bakeTexture } from './bake-texture';
import { FONT_FAMILY, FONT_WEIGHT } from './fonts';

const cfg = MASTER_ANIM.caption;

/** A baked caption: the texture and the size of its picture. */
export interface CaptionArt {
  key: string;
  width: number;
  height: number;
}

/** Plate colours: a warm dark gold with a light rim, so the light name and the gold star read on it. */
const PLATE = {
  fill: 0x7a4f0a,
  fillAlpha: 0.92,
  rim: 0xffe28a,
  rimAlpha: 0.9,
  rimWidth: 4,
} as const;

function nameFont(): string {
  return `${FONT_WEIGHT.black} ${cfg.nameFont}px ${FONT_FAMILY}`;
}

/** Width of `text` in the caption font, measured on a scratch canvas. */
function measure(text: string): number {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return text.length * cfg.nameFont;
  context.font = nameFont();
  return context.measureText(text).width;
}

/**
 * Bakes the caption of `creature` (gold star and the name of its master effect on a plate) into
 * one picture on the shared atlas, in the language of the moment: one draw per caption instead of
 * a plate, a star and a text. Safe to call again: an existing picture is kept.
 */
export function bakeCaptionArt(
  scene: Phaser.Scene,
  creature: CreatureId,
  lang: string,
): CaptionArt {
  const name = t(`mastery.${creature}.name`);
  const textWidth = Math.ceil(measure(name)) + cfg.nameStroke * 2;
  const width = Math.ceil(cfg.padX * 2 + cfg.starSize + cfg.starGap + textWidth);
  const height = cfg.height;
  const key = `ui_hud_master_caption_${creature}_${lang}`;
  bakeTexture(
    scene,
    key,
    width,
    height,
    (g) => {
      const rim = PLATE.rimWidth;
      g.fillStyle(PLATE.fill, PLATE.fillAlpha).fillRoundedRect(0, 0, width, height, height / 2);
      g.lineStyle(rim, PLATE.rim, PLATE.rimAlpha).strokeRoundedRect(
        rim / 2,
        rim / 2,
        width - rim,
        height - rim,
        height / 2 - rim / 2,
      );
      // The star: filled gold fan with a darker outline.
      const cx = cfg.padX + cfg.starSize / 2;
      const cy = height / 2;
      g.fillStyle(cfg.gold, 1);
      fillFan(g, cx, cy, starRadii(cfg.starSize / 2));
    },
    (context) => {
      // The name: light letters with the dark outline of the HUD texts.
      context.font = nameFont();
      context.textBaseline = 'middle';
      context.lineJoin = 'round';
      context.lineWidth = cfg.nameStroke;
      context.strokeStyle = cssColor(PALETTE.textDark);
      context.fillStyle = cssColor(PALETTE.textLight);
      const x = cfg.padX + cfg.starSize + cfg.starGap + cfg.nameStroke;
      context.strokeText(name, x, height / 2);
      context.fillText(name, x, height / 2);
    },
  );
  return { key, width, height };
}
