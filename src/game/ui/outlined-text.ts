import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { PALETTE } from '../../data/palette';
import { cssColor } from '../../util/color';
import { textPadding } from '../../util/text-padding';
import { FONT_FAMILY, FONT_WEIGHT } from './fonts';

/** Chunky cartoon text: heavy font, dark outline and a hard drop shadow. */
export function createOutlinedText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  fontSize: number,
  color: number = PALETTE.textLight,
): Phaser.GameObjects.Text {
  const padding = textPadding(ANIM.hud.numberStroke, 0, ANIM.hud.shadowOffset);
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontStyle: FONT_WEIGHT.black,
      fontSize,
      color: cssColor(color),
    })
    .setOrigin(0.5)
    .setPadding(padding.x, padding.y)
    .setStroke(cssColor(PALETTE.textDark), ANIM.hud.numberStroke)
    .setShadow(0, ANIM.hud.shadowOffset, cssColor(PALETTE.textDark), 0, true, true);
}

/** Small label with a light or dark outline for readability over the scene; origin is the centre. */
export function createStrokedText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  fontSize: number,
  color: number,
  strokeColor: number,
  strokeWidth: number,
): Phaser.GameObjects.Text {
  const padding = textPadding(strokeWidth, 0, 0);
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontStyle: FONT_WEIGHT.black,
      fontSize,
      color: cssColor(color),
    })
    .setOrigin(0.5)
    .setPadding(padding.x, padding.y)
    .setStroke(cssColor(strokeColor), strokeWidth);
}
