import type * as Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { cssColor } from '../../util/color';
import { effectsMode } from '../effects-mode';
import { FONT_FAMILY, FONT_WEIGHT } from '../ui/fonts';
import type { RunInfo } from '../scenes/game-scene';

const FONT_SIZE = 30;
const MARGIN = 20;
const SPEED_DECIMALS = 0;
const WOBBLE_DECIMALS = 1;

/** Dev-only overlay with the run numbers. */
export class DebugPanel {
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add
      .text(MARGIN, 0, '', {
        fontFamily: FONT_FAMILY,
        fontStyle: FONT_WEIGHT.extraBold,
        fontSize: FONT_SIZE,
        color: cssColor(PALETTE.textDark),
      })
      .setOrigin(0, 1)
      .setStroke(cssColor(PALETTE.textLight), 4)
      .setVisible(false)
      .setDepth(1000);
  }

  get visible(): boolean {
    return this.text.visible;
  }

  setVisible(visible: boolean): void {
    this.text.setVisible(visible);
  }

  layout(screenHeight: number): void {
    this.text.setY(screenHeight - MARGIN);
  }

  update(info: RunInfo | null, fps: number): void {
    if (!this.text.visible || !info) return;
    const speed = info.flyingSpeed === null ? '-' : info.flyingSpeed.toFixed(SPEED_DECIMALS);
    this.text.setText(
      [
        `fps ${Math.round(fps)}`,
        `seed ${info.seed}`,
        `speed ${speed}`,
        `wobble ${info.wobble.toFixed(WOBBLE_DECIMALS)}`,
        `height ${info.height}`,
        `phase ${info.phase}`,
        `fx ${effectsMode.reason ?? 'full'}`,
      ].join('\n'),
    );
  }
}
