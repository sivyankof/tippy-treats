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
  // Everything goes into the style: each setter afterwards would measure the font and re-upload the canvas.
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontStyle: FONT_WEIGHT.black,
      fontSize,
      color: cssColor(color),
      padding: { left: padding.x, right: padding.x, top: padding.y, bottom: padding.y },
      stroke: cssColor(PALETTE.textDark),
      strokeThickness: ANIM.hud.numberStroke,
      shadow: {
        offsetX: 0,
        offsetY: ANIM.hud.shadowOffset,
        color: cssColor(PALETTE.textDark),
        blur: 0,
        stroke: true,
        fill: true,
      },
    })
    .setOrigin(0.5);
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
      padding: { left: padding.x, right: padding.x, top: padding.y, bottom: padding.y },
      stroke: cssColor(strokeColor),
      strokeThickness: strokeWidth,
    })
    .setOrigin(0.5);
}
