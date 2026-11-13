import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { PALETTE } from '../../data/palette';
import { cssColor } from '../../util/color';
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
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontStyle: FONT_WEIGHT.black,
      fontSize,
      color: cssColor(color),
    })
    .setOrigin(0.5)
    .setStroke(cssColor(PALETTE.textDark), ANIM.hud.numberStroke)
    .setShadow(0, ANIM.hud.shadowOffset, cssColor(PALETTE.textDark), 0, true, true);
}
